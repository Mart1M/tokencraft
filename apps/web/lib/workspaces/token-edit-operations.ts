import { prisma } from "@/lib/db/prisma";
import { createInstallationAccessToken } from "@/lib/github/app";
import {
  createRepositoryFile,
  deleteRepositoryFile,
  getRepositoryFileSha,
  readRepositoryFileContentOptional,
  writeRepositoryFile,
} from "@/lib/github/repository-write";
import { inspectTokenJson } from "@/lib/github/token-scan";
import type { ActorScope } from "@/lib/auth/scope";
import { buildStoredTokenEntry } from "@/lib/tokens/display";
import { formatDraftValue, type TokenDraft } from "@/lib/tokens/draft-utils";
import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import {
  buildJsonFromMetadata,
} from "@/lib/tokens/json-patch";
import { parseTokenFileMetadata } from "@/lib/tokens/flatten";
import { buildRawValueFromDraftInput } from "@/lib/tokens/serialize";
import { mergeTokenMetadata } from "@/lib/tokens/token-metadata";
import { getWorkspaceActiveBranch } from "@/lib/workspaces/branch";
import { getWorkspaceTokenExplorer } from "@/lib/workspaces/service";

export class TokenEditError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "TokenEditError";
  }
}

async function requireWorkspace(scope: ActorScope, workspaceId: string) {
  const workspace = await getWorkspaceTokenExplorer(scope, workspaceId);

  if (!workspace) {
    throw new TokenEditError("Workspace not found.", 404);
  }

  if (!workspace.selectedRepository) {
    throw new TokenEditError("Select a repository before editing tokens.", 400);
  }

  if (!workspace.githubInstallation) {
    throw new TokenEditError("GitHub installation is required.", 400);
  }

  return workspace;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function readRepositoryFileContent(
  accessToken: string,
  repository: NonNullable<
    Awaited<ReturnType<typeof requireWorkspace>>["selectedRepository"]
  >,
  path: string,
  branch: string
) {
  const url = new URL(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${encodePath(path)}`
  );
  url.searchParams.set("ref", branch);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new TokenEditError(`Unable to read ${path} from GitHub.`, 502);
  }

  const payload = (await response.json()) as {
    sha: string;
    content: string;
  };

  return {
    sha: payload.sha,
    content: Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

function ensureTopLevelKey(metadata: ReturnType<typeof parseTokenFileMetadata>, path: string) {
  const topLevelKey = path.split(".")[0];

  if (!topLevelKey || metadata.topLevelKeys.includes(topLevelKey)) {
    return metadata.topLevelKeys;
  }

  return [...metadata.topLevelKeys, topLevelKey];
}

function applyDraftsToMetadata(
  metadata: ReturnType<typeof parseTokenFileMetadata>,
  drafts: TokenDraft[]
) {
  let tokens = [...metadata.tokens];
  let topLevelKeys = [...metadata.topLevelKeys];

  for (const draft of drafts) {
    const operation = draft.operation ?? "update";

    if (operation === "delete") {
      tokens = tokens.filter((entry) => entry.path !== draft.path);
      continue;
    }

    const formatted = formatDraftValue(draft);
    const index = tokens.findIndex((entry) => entry.path === draft.path);

    if (operation === "create") {
      if (index !== -1) {
        throw new TokenEditError(`Token "${draft.path}" already exists.`, 409);
      }

      topLevelKeys = ensureTopLevelKey({ ...metadata, topLevelKeys, tokens }, draft.path);
      const rawValue = buildRawValueFromDraftInput(
        {
          path: draft.path,
          value: formatDtcgTokenValue(formatted, draft.type),
          ...(draft.type ? { type: draft.type } : {}),
        },
        formatted,
        draft.mode
      );

      tokens.push(
        mergeTokenMetadata(
          buildStoredTokenEntry(draft.path, draft.type, rawValue),
          draft
        )
      );
      continue;
    }

    if (index === -1) {
      continue;
    }

    const current = tokens[index];
    const rawValue = buildRawValueFromDraftInput(current, formatted, draft.mode);

    tokens[index] = mergeTokenMetadata(
      buildStoredTokenEntry(current.path, current.type, rawValue),
      draft,
      current
    );
  }

  return {
    ...metadata,
    topLevelKeys,
    tokens,
  };
}

export async function getWorkspaceTokenSyncStatus(scope: ActorScope, workspaceId: string) {
  const workspace = await requireWorkspace(scope, workspaceId);
  const repository = workspace.selectedRepository!;
  const branch = getWorkspaceActiveBranch(workspace);

  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation!.installationId.toString()
  );

  const comparisons = await Promise.all(
    workspace.tokenFiles
      .filter((file) => !file.pendingDelete && file.syncStatus !== "LOCAL")
      .map(async (file) => {
        try {
          const remoteSha = await getRepositoryFileSha({
            accessToken: token,
            repository,
            path: file.path,
            branch,
          });

          return {
            fileId: file.id,
            path: file.path,
            localSha: file.sha,
            remoteSha,
            behind: remoteSha !== file.sha,
          };
        } catch {
          return {
            fileId: file.id,
            path: file.path,
            localSha: file.sha,
            remoteSha: null,
            behind: false,
          };
        }
      })
  );

  return {
    branch,
    repositoryFullName: repository.fullName,
    behind: comparisons.some((item) => item.behind),
    files: comparisons,
  };
}

export async function commitWorkspaceTokenDrafts(
  scope: ActorScope,
  workspaceId: string,
  input: {
    message: string;
    drafts: TokenDraft[];
    pendingCollectionDeletes?: string[];
  }
) {
  const workspace = await requireWorkspace(scope, workspaceId);

  if (
    input.drafts.length === 0 &&
    !input.pendingCollectionDeletes?.length
  ) {
    throw new TokenEditError("No token edits to commit.", 400);
  }

  const draftsByFile = new Map<string, TokenDraft[]>();

  for (const draft of input.drafts) {
    const current = draftsByFile.get(draft.fileId) ?? [];
    current.push(draft);
    draftsByFile.set(draft.fileId, current);
  }

  let updatedFileCount = 0;

  for (const tokenFile of workspace.tokenFiles) {
    const fileDrafts = draftsByFile.get(tokenFile.id);

    if (fileDrafts?.length) {
      const metadata = applyDraftsToMetadata(
        parseTokenFileMetadata(tokenFile.metadata),
        fileDrafts
      );

      await prisma.tokenFile.update({
        where: { id: tokenFile.id },
        data: {
          metadata,
          tokenCount: metadata.tokens.length,
        },
      });

      updatedFileCount += 1;
    }
  }

  if (input.pendingCollectionDeletes?.length) {
    for (const fileId of input.pendingCollectionDeletes) {
      const tokenFile = workspace.tokenFiles.find((file) => file.id === fileId);

      if (!tokenFile || tokenFile.syncStatus === "LOCAL") {
        continue;
      }

      await prisma.tokenFile.update({
        where: { id: fileId },
        data: { pendingDelete: true },
      });
      updatedFileCount += 1;
    }
  }

  return {
    commitMessage: input.message,
    committedFileCount: updatedFileCount,
    branch: getWorkspaceActiveBranch(workspace),
  };
}

export async function pullWorkspaceTokenChanges(scope: ActorScope, workspaceId: string) {
  const workspace = await requireWorkspace(scope, workspaceId);
  const repository = workspace.selectedRepository!;
  const branch = getWorkspaceActiveBranch(workspace);

  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation!.installationId.toString()
  );

  let updatedCount = 0;

  for (const tokenFile of workspace.tokenFiles) {
    if (tokenFile.syncStatus === "LOCAL" || tokenFile.pendingDelete) {
      continue;
    }

    const remoteFile = await readRepositoryFileContent(token, repository, tokenFile.path, branch);

    if (remoteFile.sha === tokenFile.sha) {
      continue;
    }

    const inspection = inspectTokenJson(tokenFile.path, remoteFile.content);

    await prisma.tokenFile.update({
      where: { id: tokenFile.id },
      data: {
        sha: remoteFile.sha,
        collectionName: inspection.collectionName,
        format: inspection.format,
        tokenCount: inspection.tokenCount,
        metadata: inspection.metadata,
      },
    });

    updatedCount += 1;
  }

  return {
    updatedFileCount: updatedCount,
    branch,
  };
}

export async function pushWorkspaceTokenChanges(
  scope: ActorScope,
  workspaceId: string,
  input: { message: string; fileIds?: string[] }
) {
  const workspace = await requireWorkspace(scope, workspaceId);
  const repository = workspace.selectedRepository!;
  const branch = getWorkspaceActiveBranch(workspace);

  const { token } = await createInstallationAccessToken(
    workspace.githubInstallation!.installationId.toString()
  );

  const syncStatus = await getWorkspaceTokenSyncStatus(scope, workspaceId);

  if (syncStatus.behind) {
    throw new TokenEditError("Pull remote changes before pushing.", 409);
  }

  let pushedFileCount = 0;
  const targetFileIds = input.fileIds?.length ? new Set(input.fileIds) : null;

  for (const tokenFile of workspace.tokenFiles) {
    if (targetFileIds && !targetFileIds.has(tokenFile.id)) {
      continue;
    }

    if (tokenFile.pendingDelete) {
      if (tokenFile.syncStatus === "LOCAL" || !tokenFile.sha) {
        await prisma.tokenFile.delete({ where: { id: tokenFile.id } });
        pushedFileCount += 1;
        continue;
      }

      await deleteRepositoryFile({
        accessToken: token,
        repository,
        path: tokenFile.path,
        sha: tokenFile.sha,
        message: input.message,
        branch,
      });

      await prisma.tokenFile.delete({ where: { id: tokenFile.id } });
      pushedFileCount += 1;
      continue;
    }

    const metadata = parseTokenFileMetadata(tokenFile.metadata);
    const nextContent = `${JSON.stringify(buildJsonFromMetadata(metadata), null, 2)}\n`;

    if (tokenFile.syncStatus === "LOCAL" || !tokenFile.sha) {
      const remoteFile = await readRepositoryFileContentOptional({
        accessToken: token,
        repository,
        path: tokenFile.path,
        branch,
      });

      if (remoteFile) {
        const writeResult = await writeRepositoryFile({
          accessToken: token,
          repository,
          path: tokenFile.path,
          content: nextContent,
          sha: remoteFile.sha,
          message: input.message,
          branch,
        });

        const inspection = inspectTokenJson(tokenFile.path, nextContent);

        await prisma.tokenFile.update({
          where: { id: tokenFile.id },
          data: {
            sha: writeResult.content.sha,
            syncStatus: "SYNCED",
            tokenCount: inspection.tokenCount,
            metadata: inspection.metadata,
          },
        });
      } else {
        const writeResult = await createRepositoryFile({
          accessToken: token,
          repository,
          path: tokenFile.path,
          content: nextContent,
          message: input.message,
          branch,
        });

        const inspection = inspectTokenJson(tokenFile.path, nextContent);

        await prisma.tokenFile.update({
          where: { id: tokenFile.id },
          data: {
            sha: writeResult.content.sha,
            syncStatus: "SYNCED",
            tokenCount: inspection.tokenCount,
            metadata: inspection.metadata,
          },
        });
      }

      pushedFileCount += 1;
      continue;
    }

    const remoteFile = await readRepositoryFileContentOptional({
      accessToken: token,
      repository,
      path: tokenFile.path,
      branch,
    });

    if (!remoteFile) {
      const writeResult = await createRepositoryFile({
        accessToken: token,
        repository,
        path: tokenFile.path,
        content: nextContent,
        message: input.message,
        branch,
      });

      const inspection = inspectTokenJson(tokenFile.path, nextContent);

      await prisma.tokenFile.update({
        where: { id: tokenFile.id },
        data: {
          sha: writeResult.content.sha,
          syncStatus: "SYNCED",
          tokenCount: inspection.tokenCount,
          metadata: inspection.metadata,
        },
      });

      pushedFileCount += 1;
      continue;
    }

    const patchedContent = `${JSON.stringify(buildJsonFromMetadata(metadata), null, 2)}\n`;
    const writeResult = await writeRepositoryFile({
      accessToken: token,
      repository,
      path: tokenFile.path,
      content: patchedContent,
      sha: remoteFile.sha,
      message: input.message,
      branch,
    });

    const inspection = inspectTokenJson(tokenFile.path, patchedContent);

    await prisma.tokenFile.update({
      where: { id: tokenFile.id },
      data: {
        sha: writeResult.content.sha,
        tokenCount: inspection.tokenCount,
        metadata: inspection.metadata,
      },
    });

    pushedFileCount += 1;
  }

  return {
    pushedFileCount,
    branch,
  };
}

export { applyDraftsToMetadata };
