"use client";

import { use } from "react";
import { ChevronRight } from "lucide-react";

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
  const modes = data?.modes ?? [];
  const settingsHref = workspaceSettingsPath(workspace.slug);

  const headerTitle = (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{workspace.name}</span>
      <ChevronRight size={14} className="text-muted-foreground" />
      <span className="font-medium text-foreground">Tokens</span>
    </span>
  );

  return (
    <DashboardLayout
      showTokensSidebar
      tokenSidebarCollections={collections}
      tokenExplorerModes={modes}
      tokens={tokens}
    >
      {isLoading && !data ? (
        <div className="dashboard-content-compact">
          <p className="text-sm text-muted-foreground">Loading tokens…</p>
        </div>
      ) : (
        <TokenExplorerWorkspace
          title={headerTitle}
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
