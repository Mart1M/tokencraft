"use client";

import type { ReactNode } from "react";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { TokenEditPanel } from "@/components/token-edit-panel";
import { TokenGitToolbar } from "@/components/token-git-toolbar";
import { TokensCollectionsEmptyState } from "@/components/tokens-collections-empty-state";
import { TokensExplorerTable } from "@/components/tokens-explorer-table";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { cn } from "@/lib/utils";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

export function TokenExplorerWorkspace({
  title,
  tokens,
  settingsHref,
  workspaceId,
  branch,
  initialRemoteChanges,
  collections,
}: {
  title: ReactNode;
  tokens: ImportedTokenRow[];
  settingsHref: string;
  workspaceId: string;
  branch: string;
  initialRemoteChanges: boolean;
  collections: Array<{ id: string; name: string; path: string }>;
}) {
  const isPanelOpen = useTokenDraftStore((state) => state.isPanelOpen);
  const hasCollections = collections.length > 0;

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden transition-[margin] duration-200",
          isPanelOpen && "mr-[420px]"
        )}
      >
        <div className="shrink-0 px-8">
          <DashboardPageHeader
            title={title}
            actions={
              <TokenGitToolbar
                workspaceId={workspaceId}
                branch={branch}
                initialRemoteChanges={initialRemoteChanges}
              />
            }
          />
        </div>
        {hasCollections ? (
          <TokensExplorerTable
            tokens={tokens}
            settingsHref={settingsHref}
            collections={collections}
          />
        ) : (
          <TokensCollectionsEmptyState settingsHref={settingsHref} />
        )}
      </div>
      <TokenEditPanel tokens={tokens} />
    </>
  );
}
