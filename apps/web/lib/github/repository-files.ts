import type { GitHubRepository } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { createInstallationAccessToken } from "@/lib/github/app";
import { inspectTokenJson } from "@/lib/github/token-scan";
import { writeTokencraftConfigToRepository } from "@/lib/github/tokencraft-config";
import { TOKENCRAFT_CONFIG_FILENAME } from "@/lib/tokencraft/config";

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

export type RepositoryJsonFile = {
  path: string;
  sha: string;
  size: number;
};

const MAX_JSON_FILE_BYTES = 512 * 1024;
const MAX_JSON_FILES = 500;

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

export function isBrowsableJsonPath(path: string) {
  const lowerPath = path.toLowerCase();

  if (!lowerPath.endsWith(".json")) {
    return false;
  }

  if (
    lowerPath === TOKENCRAFT_CONFIG_FILENAME ||
    lowerPath.endsWith(`/${TOKENCRAFT_CONFIG_FILENAME}`)
  ) {
    return false;
  }

  if (
    lowerPath.includes("node_modules/") ||
    lowerPath.includes(".next/") ||
    lowerPath.includes("package-lock.json") ||
    lowerPath.includes("pnpm-lock") ||
    lowerPath.includes("/dist/") ||
    lowerPath.includes("/build/")
  ) {
    return false;
  }

  return true;
}

export async function listRepositoryJsonFiles(
  repository: GitHubRepository,
  branch: string
) {
  const installation = await prisma.gitHubInstallation.findUniqueOrThrow({
    where: { id: repository.installationId }
  });
  const { token } = await createInstallationAccessToken(
    installation.installationId.toString()
  );

  const treeUrl = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/git/trees/${encodeURIComponent(branch)}`
  );
  treeUrl.searchParams.set("recursive", "1");

  const tree = await requestRepositoryJson<GitTreeResponse>(token, treeUrl.toString());

  return tree.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        typeof item.size === "number" &&
        item.size > 0 &&
        item.size <= MAX_JSON_FILE_BYTES &&
        isBrowsableJsonPath(item.path)
    )
    .map((item) => ({
      path: item.path,
      sha: item.sha,
      size: item.size as number
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, MAX_JSON_FILES);
}

async function readRepositoryFile(
  token: string,
  repository: GitHubRepository,
  path: string,
  branch: string
) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodePath(path)}`
  );
  url.searchParams.set("ref", branch);

  const content = await requestRepositoryJson<GitHubContentFileResponse>(token, url.toString());
  return {
    sha: content.sha,
    content: Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf8")
  };
}

export async function importRepositoryTokenFiles({
  workspaceId,
  repositoryId,
  paths,
  branch,
  syncConfig = true,
}: {
  workspaceId: string;
  repositoryId: string;
  paths: string[];
  branch: string;
  syncConfig?: boolean;
}) {
  const uniquePaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];

  if (uniquePaths.length === 0) {
    throw new Error("Select at least one JSON file.");
  }

  const repository = await prisma.gitHubRepository.findUniqueOrThrow({
    where: { id: repositoryId },
    include: { installation: true }
  });

  const { token } = await createInstallationAccessToken(
    repository.installation.installationId.toString()
  );

  const importedFiles = [];

  for (const path of uniquePaths) {
    try {
      const file = await readRepositoryFile(token, repository, path, branch);
      const inspection = inspectTokenJson(path, file.content);

      importedFiles.push({
        path,
        sha: file.sha,
        ...inspection
      });
    } catch {
      // Skip unreadable or invalid JSON files.
    }
  }

  if (importedFiles.length === 0) {
    throw new Error("None of the selected files could be imported as JSON token files.");
  }

  await prisma.$transaction([
    prisma.tokenFile.deleteMany({
      where: {
        workspaceId,
        repositoryId,
        syncStatus: "SYNCED",
      },
    }),
    ...importedFiles.map((file) =>
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
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { connectionStatus: "REPOSITORY_SELECTED" }
    })
  ]);

  if (syncConfig) {
    await writeTokencraftConfigToRepository(
      token,
      repository,
      branch,
      importedFiles.map((file) => file.path)
    );
  }

  return { importedFileCount: importedFiles.length };
}
