"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { TokenEditPanel } from "@/components/token-edit-panel";
import { getWorkspaceChangeCount, TokenChangesReview } from "@/components/token-changes-review";
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
  workspaceName,
  tokens,
  settingsHref,
  collections,
}: {
  workspaceName: string;
  tokens: ImportedTokenRow[];
  settingsHref: string;
  collections: Array<{ id: string; name: string; path: string }>;
}) {
  const isPanelOpen = useTokenDraftStore((state) => state.isPanelOpen);
  const openCreateToken = useTokenDraftStore((state) => state.openCreateToken);
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );
  const drafts = useTokenDraftStore((state) => state.drafts);
  const pendingCollectionCreates = useTokenDraftStore((state) => state.pendingCollectionCreates);
  const pendingModeChanges = useTokenDraftStore((state) => state.pendingModeChanges);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { selectedCollectionId, selectedGroupSegments } = useTokenExplorer();
  const { status, error, hasLocalEdits, save } = useTokenAutoSave();
  const hasCollections = collections.length > 0;

  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  );
  const canAddToken = Boolean(
    selectedCollection && !pendingCollectionDeletes.includes(selectedCollection.id),
  );
  const viewSegments =
    selectedGroupSegments === null
      ? ["All tokens"]
      : selectedGroupSegments.length === 0
        ? ["Ungrouped"]
        : selectedGroupSegments;
  const breadcrumbSegments = [
    workspaceName,
    selectedCollection?.name ?? "Tokens",
    ...viewSegments,
  ];
  const headerTitle = (
    <nav
      aria-label="Token view breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap text-sm"
    >
      {breadcrumbSegments.map((segment, index) => (
        <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-2">
          {index > 0 ? <ChevronRight size={14} className="text-muted-foreground" /> : null}
          <span
            className={
              index === breadcrumbSegments.length - 1
                ? "truncate font-medium text-foreground"
                : "truncate text-muted-foreground"
            }
          >
            {segment}
          </span>
        </span>
      ))}
    </nav>
  );
  const changeCount = getWorkspaceChangeCount({
    drafts,
    pendingCollectionDeletes,
    pendingCollectionCreates,
    pendingModeChanges,
  });

  useEffect(() => {
    const preventExit = (event: BeforeUnloadEvent) => {
      if (!hasLocalEdits) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventExit);
    return () => window.removeEventListener("beforeunload", preventExit);
  }, [hasLocalEdits]);

  async function handleSave() {
    await save();
    if (useTokenDraftStore.getState().hasLocalEdits() === false) {
      setReviewOpen(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden transition-[margin] duration-200",
          isPanelOpen && "mr-[480px]"
        )}
      >
        <div className="shrink-0 px-8">
          <DashboardPageHeader
            title={headerTitle}
            actions={
              <div className="flex items-center gap-3">
                <TokenAutoSaveStatus status={status} error={error} />
                <div className="inline-flex items-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleSave()}
                    disabled={!changeCount || status === "saving"}
                    className="rounded-r-none"
                  >
                    {status === "saving" ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Review ${changeCount} change${changeCount === 1 ? "" : "s"}`}
                    onClick={() => setReviewOpen(true)}
                    className="rounded-l-none border-l-0 px-2.5 font-mono tabular-nums"
                  >
                    {changeCount}
                  </Button>
                </div>
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
      <TokenChangesReview
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        tokens={tokens}
        collections={collections}
        status={status}
        error={error}
        onSave={handleSave}
      />
    </>
  );
}
