import type { GitHubRepository, Workspace } from "@prisma/client";

type WorkspaceWithRepository = Pick<Workspace, "activeBranch"> & {
  selectedRepository: Pick<GitHubRepository, "defaultBranch"> | null;
};

export function getWorkspaceActiveBranch(workspace: WorkspaceWithRepository) {
  return workspace.activeBranch ?? workspace.selectedRepository?.defaultBranch ?? "main";
}

export function isValidBranchName(name: string) {
  const trimmed = name.trim();

  if (!trimmed || trimmed.length > 255) {
    return false;
  }

  if (trimmed.startsWith("/") || trimmed.endsWith("/") || trimmed.includes("//")) {
    return false;
  }

  if (trimmed.includes("..") || trimmed.includes("@{")) {
    return false;
  }

  return /^[a-zA-Z0-9._/-]+$/.test(trimmed);
}
