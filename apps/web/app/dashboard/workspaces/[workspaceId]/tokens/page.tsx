"use client";

import { use } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { TokenExplorerWorkspace } from "@/components/token-explorer-workspace";
import { WorkspaceDataProvider, useWorkspaceData } from "@/components/workspace-data-provider";
import { workspaceSettingsPath } from "@/lib/workspaces/repository-route-utils";

export default function TokenExplorerPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  return (
    <WorkspaceDataProvider workspaceId={workspaceId}>
      <TokenExplorerPageContent />
    </WorkspaceDataProvider>
  );
}

function TokenExplorerPageContent() {
  const { workspace, data, isLoading } = useWorkspaceData();

  if (!workspace) {
    return null;
  }

  const tokens = data?.tokens ?? [];
  const collections = data?.collections ?? [];
  const folders = data?.folders ?? [];
  const modes = data?.modes ?? [];
  const settingsHref = workspaceSettingsPath(workspace.slug);

  return (
    <DashboardLayout
      showTokensSidebar
      tokenSidebarCollections={collections}
      tokenSidebarFolders={folders}
      tokenExplorerModes={modes}
      tokens={tokens}
    >
      {isLoading && !data ? (
        <div className="dashboard-content-compact">
          <p className="text-sm text-muted-foreground">Loading tokens…</p>
        </div>
      ) : (
        <TokenExplorerWorkspace
          workspaceName={workspace.name}
          tokens={tokens}
          settingsHref={settingsHref}
          collections={collections.map((collection) => ({
            id: collection.id,
            name: collection.name,
            path: collection.path,
          }))}
        />
      )}
    </DashboardLayout>
  );
}
