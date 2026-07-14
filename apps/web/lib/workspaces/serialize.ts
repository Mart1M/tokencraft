import type { GitHubInstallation, Workspace, WorkspaceConnectionStatus } from "@prisma/client";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  connectionStatus: WorkspaceConnectionStatus;
  hasGitHubInstallation: boolean;
  hasSelectedRepository: boolean;
};

type WorkspaceWithRelations = Workspace & {
  githubInstallation?: GitHubInstallation | null;
  selectedRepository?: { id: string } | null;
};

export function serializeWorkspaceSummary(
  workspace: WorkspaceWithRelations,
  options?: { hasScopeGitHubInstallation?: boolean }
): WorkspaceSummary {
  const hasGitHubInstallation = Boolean(
    options?.hasScopeGitHubInstallation ?? workspace.githubInstallation
  );

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    connectionStatus: workspace.connectionStatus,
    hasGitHubInstallation,
    hasSelectedRepository: Boolean(workspace.selectedRepository),
  };
}

export function serializeWorkspaceSummaries(
  workspaces: WorkspaceWithRelations[],
  options?: { hasScopeGitHubInstallation?: boolean }
) {
  return workspaces.map((workspace) => serializeWorkspaceSummary(workspace, options));
}
