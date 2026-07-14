import type { GitHubRepository } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { createInstallationAccessToken } from "@/lib/github/app";
import { flattenTokenEntries } from "@/lib/tokens/flatten";

type GitTreeResponse = {
  tree: Array<{
    path: string;
    type: "blob" | "tree" | "commit";
    sha: string;
    size?: number;
  }>;
  truncated: boolean;
};

type GitHubContentFileResponse = {
  type: "file";
  path: string;
  sha: string;
  size: number;
  encoding: "base64";
  content: string;
};

type TokenCandidate = {
  path: string;
  sha: string;
  size: number;
};

const MAX_TOKEN_FILE_BYTES = 512 * 1024;
const MAX_FILES_TO_PARSE = 50;

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function requestRepositoryJson<T>(token: string, url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`GitHub repository request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function isLikelyTokenPath(path: string) {
  const lowerPath = path.toLowerCase();

  if (!lowerPath.endsWith(".json")) {
    return false;
  }

  if (
    lowerPath.includes("node_modules/") ||
    lowerPath.includes(".next/") ||
    lowerPath.includes("package-lock.json") ||
    lowerPath.includes("pnpm-lock")
  ) {
    return false;
  }

  const segments = lowerPath.split("/");
  const fileName = segments.at(-1) ?? "";

  return (
    fileName.includes("token") ||
    lowerPath.includes("/tokens/") ||
    lowerPath.includes("/design-tokens/") ||
    lowerPath.includes("/design_tokens/")
  );
}

function formatCollectionName(path: string) {
  const fileName =
    path
      .split("/")
      .at(-1)
      ?.replace(/\.tokens?\.json$/i, "")
      .replace(/\.json$/i, "") ?? path;
  return fileName
    .replace(/[-_]+/g, " ")
    .replace(/\btokens?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || fileName;
}

function countTokenNodes(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }

  const record = value as Record<string, unknown>;
  const isToken = "$value" in record || "value" in record;
  let count = isToken ? 1 : 0;

  for (const child of Object.values(record)) {
    count += countTokenNodes(child);
  }

  return count;
}

function guessTokenFormat(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "CUSTOM" as const;
  }

  const serialized = JSON.stringify(value).slice(0, 20000);
  if (serialized.includes('"$value"') || serialized.includes('"$type"')) {
    return "DTCG" as const;
  }

  if (serialized.includes('"value"') && serialized.includes('"type"')) {
    return "TOKENS_STUDIO" as const;
  }

  return "CUSTOM" as const;
}

export function inspectTokenJson(path: string, content: string) {
  const json = JSON.parse(content) as unknown;
  const tokenCount = countTokenNodes(json);
  const tokens = flattenTokenEntries(json);

  return {
    collectionName: formatCollectionName(path),
    format: guessTokenFormat(json),
    tokenCount,
    metadata: {
      topLevelKeys: json && typeof json === "object" && !Array.isArray(json)
        ? Object.keys(json as Record<string, unknown>).slice(0, 20)
        : [],
      tokens
    }
  };
}

async function listTokenCandidates(token: string, repository: GitHubRepository) {
  const treeUrl = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/git/trees/${encodeURIComponent(
      repository.defaultBranch
    )}`
  );
  treeUrl.searchParams.set("recursive", "1");

  const tree = await requestRepositoryJson<GitTreeResponse>(token, treeUrl.toString());

  return tree.tree
    .filter((item) =>
      item.type === "blob" &&
      typeof item.size === "number" &&
      item.size > 0 &&
      item.size <= MAX_TOKEN_FILE_BYTES &&
      isLikelyTokenPath(item.path)
    )
    .map((item) => ({
      path: item.path,
      sha: item.sha,
      size: item.size as number
    }))
    .slice(0, MAX_FILES_TO_PARSE);
}

async function readRepositoryFile(
  token: string,
  repository: GitHubRepository,
  candidate: TokenCandidate
) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodePath(
      candidate.path
    )}`
  );
  url.searchParams.set("ref", repository.defaultBranch);

  const content = await requestRepositoryJson<GitHubContentFileResponse>(token, url.toString());
  return Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf8");
}

export async function scanRepositoryTokenFiles({
  workspaceId,
  repositoryId
}: {
  workspaceId: string;
  repositoryId: string;
}) {
  const repository = await prisma.gitHubRepository.findUniqueOrThrow({
    where: { id: repositoryId },
    include: { installation: true }
  });

  const scan = await prisma.tokenScan.create({
    data: {
      workspaceId,
      repositoryId,
      status: "RUNNING"
    }
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { connectionStatus: "SCAN_PENDING" }
  });

  try {
    const { token } = await createInstallationAccessToken(
      repository.installation.installationId.toString()
    );
    const candidates = await listTokenCandidates(token, repository);
    const tokenFiles = [];

    for (const candidate of candidates) {
      try {
        const content = await readRepositoryFile(token, repository, candidate);
        const inspection = inspectTokenJson(candidate.path, content);

        if (inspection.tokenCount > 0) {
          tokenFiles.push({
            path: candidate.path,
            sha: candidate.sha,
            ...inspection
          });
        }
      } catch {
        // Skip invalid JSON or unreadable candidates and keep scanning.
      }
    }

    await prisma.$transaction([
      prisma.tokenFile.deleteMany({
        where: {
          workspaceId,
          repositoryId,
          syncStatus: "SYNCED",
        },
      }),
      ...tokenFiles.map((file) =>
        prisma.tokenFile.upsert({
          where: {
            workspaceId_path: {
              workspaceId,
              path: file.path,
            },
          },
          create: {
            workspaceId,
            repositoryId,
            path: file.path,
            sha: file.sha,
            syncStatus: "SYNCED",
            pendingDelete: false,
            collectionName: file.collectionName,
            format: file.format,
            tokenCount: file.tokenCount,
            metadata: file.metadata,
          },
          update: {
            sha: file.sha,
            syncStatus: "SYNCED",
            pendingDelete: false,
            collectionName: file.collectionName,
            format: file.format,
            tokenCount: file.tokenCount,
            metadata: file.metadata,
          },
        })
      ),
      prisma.tokenScan.update({
        where: { id: scan.id },
        data: {
          status: "SUCCESS",
          scannedFileCount: candidates.length,
          tokenFileCount: tokenFiles.length,
          completedAt: new Date(),
          message: tokenFiles.length > 0 ? null : "No token files were discovered."
        }
      }),
      prisma.workspace.update({
        where: { id: workspaceId },
        data: { connectionStatus: "REPOSITORY_SELECTED" }
      })
    ]);

    return { scannedFileCount: candidates.length, tokenFileCount: tokenFiles.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repository scan failed.";

    await prisma.$transaction([
      prisma.tokenScan.update({
        where: { id: scan.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          message
        }
      }),
      prisma.workspace.update({
        where: { id: workspaceId },
        data: { connectionStatus: "REPOSITORY_SELECTED" }
      })
    ]);

    return {
      scannedFileCount: 0,
      tokenFileCount: 0,
      failed: true as const,
      message
    };
  }
}
