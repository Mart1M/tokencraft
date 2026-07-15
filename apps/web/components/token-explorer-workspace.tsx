"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { TokenEditPanel } from "@/components/token-edit-panel";
import { useTokenExplorer } from "@/components/token-explorer-provider";
import { TokensCollectionsEmptyState } from "@/components/tokens-collections-empty-state";
import { TokensExplorerTable } from "@/components/tokens-explorer-table";
import { Button } from "@/components/ui/button";
import { useTokenAutoSave } from "@/hooks/use-token-auto-save";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { cn } from "@/lib/utils";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

function TokenAutoSaveStatus({
  status,
  error,
}: {
  status: ReturnType<typeof useTokenAutoSave>["status"];
  error: string | null;
}) {
  if (status === "saving") {
    return <span className="text-xs text-muted-foreground">Saving…</span>;
  }

  if (status === "saved") {
    return <span className="text-xs text-muted-foreground">Saved</span>;
  }

  if (status === "error" && error) {
    return <span className="text-xs text-destructive">{error}</span>;
  }

  return null;
}

export function TokenExplorerWorkspace({
  title,
  tokens,
  settingsHref,
  collections,
}: {
  title: ReactNode;
  tokens: ImportedTokenRow[];
  settingsHref: string;
  collections: Array<{ id: string; name: string; path: string }>;
}) {
  const isPanelOpen = useTokenDraftStore((state) => state.isPanelOpen);
  const openCreateToken = useTokenDraftStore((state) => state.openCreateToken);
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );
  const { selectedCollectionId } = useTokenExplorer();
  const { status, error } = useTokenAutoSave();
  const hasCollections = collections.length > 0;

  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  );
  const canAddToken = Boolean(
    selectedCollection && !pendingCollectionDeletes.includes(selectedCollection.id),
  );

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
              <div className="flex items-center gap-3">
                <TokenAutoSaveStatus status={status} error={error} />
                {canAddToken ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() =>
                      openCreateToken({
                        fileId: selectedCollection!.id,
                        collectionName: selectedCollection!.name,
                        sourcePath: selectedCollection!.path,
                      })
                    }
                  >
                    <Plus size={14} />
                    Add token
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>
        {hasCollections ? (
          <TokensExplorerTable tokens={tokens} />
        ) : (
          <TokensCollectionsEmptyState settingsHref={settingsHref} />
        )}
      </div>
      <TokenEditPanel tokens={tokens} />
    </>
  );
}
