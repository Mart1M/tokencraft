import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardLayout } from "@/components/dashboard-layout";
import { GitHubConnectionEmptyState } from "@/components/github-connection-empty-state";
import { TokenExplorerWorkspace } from "@/components/token-explorer-workspace";
import { getAuthSession } from "@/lib/auth/session";
import { collectTokenModes } from "@/lib/tokens/display";
import { getImportedTokenRows, getTokenSidebarCollections } from "@/lib/tokens/entries";
import { getWorkspaceActiveBranch } from "@/lib/workspaces/branch";
import { getWorkspaceTokenSyncStatus } from "@/lib/workspaces/token-edit-operations";
import { getWorkspaceTokenExplorer } from "@/lib/workspaces/service";

export const dynamic = "force-dynamic";

export default async function TokenExplorerPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await getAuthSession();

  if (!session) {
    redirect("/auth/sign-in");
  }

  const workspace = await getWorkspaceTokenExplorer(session.scope, workspaceId);
  const hasScopeGitHub = Boolean(workspace?.githubInstallation);
  const hasSelectedRepository = Boolean(workspace?.selectedRepository);
  const tokenRows = workspace ? getImportedTokenRows(workspace.tokenFiles) : [];
  const settingsHref = `/dashboard/workspaces/${encodeURIComponent(workspace?.slug ?? workspaceId)}/settings`;
  const tokenSidebarCollections = workspace
    ? getTokenSidebarCollections(workspace.tokenFiles)
    : [];
  const tokenExplorerModes = collectTokenModes(tokenRows);
  const activeBranch = workspace ? getWorkspaceActiveBranch(workspace) : "main";
  const syncStatus =
    workspace && workspace.tokenFiles.length > 0
      ? await getWorkspaceTokenSyncStatus(session.scope, workspaceId).catch(() => ({
          branch: activeBranch,
          behind: false,
        }))
      : null;

  const headerTitle = (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        {workspace?.name ?? "Workspace"}
      </span>
      <ChevronRight size={14} className="text-muted-foreground" />
      <span className="font-medium text-foreground">Tokens</span>
    </span>
  );

  return (
    <DashboardLayout
      showTokensSidebar={Boolean(workspace?.selectedRepository)}
      tokenSidebarCollections={tokenSidebarCollections}
      tokenExplorerModes={tokenExplorerModes}
      workspaceId={workspace?.slug ?? workspaceId}
    >
      {!workspace ? (
        <>
          <div className="dashboard-content-compact">
            <GitHubConnectionEmptyState workspaceId={workspaceId} />
          </div>
        </>
      ) : !hasScopeGitHub ? (
        <div className="dashboard-content-compact">
          <GitHubConnectionEmptyState workspaceId={workspace.slug} />
        </div>
      ) : !hasSelectedRepository ? (
        <div className="dashboard-content-compact">
          <GitHubConnectionEmptyState
            workspaceId={workspace.slug}
            variant="workspace"
          />
        </div>
      ) : (
        <TokenExplorerWorkspace
          title={headerTitle}
          tokens={tokenRows}
          settingsHref={settingsHref}
          workspaceId={workspace.slug}
          branch={syncStatus?.branch ?? activeBranch}
          initialRemoteChanges={Boolean(syncStatus?.behind)}
          collections={tokenSidebarCollections.map((collection) => ({
            id: collection.id,
            name: collection.name,
            path: collection.path,
          }))}
        />
      )}
    </DashboardLayout>
  );
}
