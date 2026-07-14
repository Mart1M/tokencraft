"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { Plus } from "lucide-react";

import { useTokenExplorer } from "@/components/token-explorer-provider";
import { TokensExplorerDataGrid } from "@/components/tokens-explorer-data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { buildPendingTokenId } from "@/lib/tokens/draft-utils";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

function buildCreatePreviewRow(
  draft: NonNullable<
    ReturnType<typeof useTokenDraftStore.getState>["drafts"][string]
  >,
  tokens: ImportedTokenRow[],
): ImportedTokenRow {
  const collection = tokens.find((token) => token.fileId === draft.fileId);

  return {
    id: draft.tokenId,
    fileId: draft.fileId,
    sourcePath: collection?.sourcePath ?? "",
    collectionName: collection?.collectionName ?? "Collection",
    name: draft.path,
    value: draft.rawValue,
    ...(draft.type ? { type: draft.type } : {}),
  };
}

export function TokensExplorerTable({
  tokens,
  settingsHref,
  collections,
}: {
  tokens: ImportedTokenRow[];
  settingsHref: string;
  collections: Array<{ id: string; name: string; path: string }>;
}) {
  const { availableModes, resolvedMode, setActiveMode, selectedCollectionId } =
    useTokenExplorer();
  const drafts = useTokenDraftStore((state) => state.drafts);
  const openToken = useTokenDraftStore((state) => state.openToken);
  const openCreateToken = useTokenDraftStore((state) => state.openCreateToken);
  const selectedTokenId = useTokenDraftStore((state) => state.selectedTokenId);
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );

  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  );

  const collectionTokens = useMemo(() => {
    if (!selectedCollectionId) {
      return [];
    }

    return tokens.filter((token) => token.fileId === selectedCollectionId);
  }, [tokens, selectedCollectionId]);

  const createDrafts = useMemo(
    () =>
      Object.values(drafts).filter(
        (draft) =>
          draft.operation === "create" &&
          (!selectedCollectionId || draft.fileId === selectedCollectionId),
      ),
    [drafts, selectedCollectionId],
  );

  const visibleTokens = useMemo(() => {
    const previewRows = createDrafts.map((draft) =>
      buildCreatePreviewRow(draft, tokens),
    );
    return [...collectionTokens, ...previewRows];
  }, [collectionTokens, createDrafts, tokens]);

  const handleTokenRowActivate = useCallback(
    (rowId: string) => openToken(rowId),
    [openToken],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-8">
        {availableModes.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mode</span>
            <div className="inline-flex items-center gap-1 rounded-lg border p-1">
              {availableModes.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={resolvedMode === mode ? "secondary" : "ghost"}
                  className="h-7 px-3 capitalize"
                  onClick={() => setActiveMode(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {selectedCollection &&
          !pendingCollectionDeletes.includes(selectedCollection.id) ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() =>
                openCreateToken({
                  fileId: selectedCollection.id,
                  collectionName: selectedCollection.name,
                  sourcePath: selectedCollection.path,
                })
              }
            >
              <Plus size={14} />
              Add token
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 w-full flex-col">
        {!selectedCollectionId ? null : visibleTokens.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No tokens in this collection yet. Use Add token to create one.
          </div>
        ) : (
          <TokensExplorerDataGrid
            rows={visibleTokens}
            resolvedMode={resolvedMode}
            drafts={drafts}
            selectedTokenId={selectedTokenId}
            onTokenRowActivate={handleTokenRowActivate}
          />
        )}
      </div>
    </div>
  );
}

export { buildPendingTokenId };
