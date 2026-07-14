import { prisma } from "@/lib/db/prisma";
import type { ActorScope } from "@/lib/auth/scope";
import { getWorkspaceActiveBranch } from "@/lib/workspaces/branch";
import { getWorkspaceTokenExplorer } from "@/lib/workspaces/service";

export class CollectionOperationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "CollectionOperationError";
  }
}

function normalizeCollectionPath(path: string) {
  return path.trim().replace(/^\/+/, "");
}

function validateCollectionPath(path: string) {
  const normalized = normalizeCollectionPath(path);

  if (!normalized) {
    throw new CollectionOperationError("Collection path is required.");
  }

  if (!normalized.toLowerCase().endsWith(".json")) {
    throw new CollectionOperationError("Collection path must end with .json.");
  }

  if (normalized.includes("..")) {
    throw new CollectionOperationError("Collection path is invalid.");
  }

  return normalized;
}

function deriveCollectionName(path: string, displayName?: string) {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  const filename = path.split("/").pop() ?? path;
  return filename.replace(/\.json$/i, "");
}

function deriveTopLevelKeysFromPath(_path: string) {
  return [];
}

async function requireWorkspace(scope: ActorScope, workspaceId: string) {
  const workspace = await getWorkspaceTokenExplorer(scope, workspaceId);

  if (!workspace) {
    throw new CollectionOperationError("Workspace not found.", 404);
  }

  if (!workspace.selectedRepository) {
    throw new CollectionOperationError("Select a repository before managing collections.", 400);
  }

  return workspace;
}

export async function createWorkspaceCollection(
  scope: ActorScope,
  workspaceId: string,
  input: { path: string; collectionName?: string }
) {
  const workspace = await requireWorkspace(scope, workspaceId);
  const path = validateCollectionPath(input.path);
  const collectionName = deriveCollectionName(path, input.collectionName);

  const existing = await prisma.tokenFile.findUnique({
    where: {
      workspaceId_path: {
        workspaceId: workspace.id,
        path,
      },
    },
  });

  if (existing) {
    throw new CollectionOperationError("A collection already exists at this path.", 409);
  }

  const topLevelKeys = deriveTopLevelKeysFromPath(
    path.replace(/\.json$/i, "").split("/").pop() ?? ""
  );

  const tokenFile = await prisma.tokenFile.create({
    data: {
      workspaceId: workspace.id,
      repositoryId: workspace.selectedRepository!.id,
      path,
      sha: null,
      syncStatus: "LOCAL",
      pendingDelete: false,
      collectionName,
      format: "DTCG",
      tokenCount: 0,
      metadata: {
        topLevelKeys,
        tokens: [],
      },
    },
  });

  return {
    collection: tokenFile,
    branch: getWorkspaceActiveBranch(workspace),
  };
}

export async function deleteWorkspaceCollection(
  scope: ActorScope,
  workspaceId: string,
  fileId: string
) {
  const workspace = await requireWorkspace(scope, workspaceId);
  const tokenFile = workspace.tokenFiles.find((file) => file.id === fileId);

  if (!tokenFile) {
    throw new CollectionOperationError("Collection not found.", 404);
  }

  if (tokenFile.syncStatus === "LOCAL") {
    await prisma.tokenFile.delete({
      where: { id: fileId },
    });

    return {
      deleted: true,
      pendingDelete: false,
      branch: getWorkspaceActiveBranch(workspace),
    };
  }

  await prisma.tokenFile.update({
    where: { id: fileId },
    data: { pendingDelete: true },
  });

  return {
    deleted: false,
    pendingDelete: true,
    branch: getWorkspaceActiveBranch(workspace),
  };
}
