"use client";

import { useCallback, useMemo } from "react";

import { useTokenExplorer } from "@/components/token-explorer-provider";
import { TokensExplorerDataGrid } from "@/components/tokens-explorer-data-grid";
import { useCollectionModeOperations } from "@/hooks/use-collection-mode-operations";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import { getTokenGroupSegments, tokenMatchesGroup } from "@/lib/tokens/token-tree";

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
}: {
  tokens: ImportedTokenRow[];
}) {
  const {
    availableModes,
    selectedCollectionId,
    selectedGroupSegments,
    addMode,
  } = useTokenExplorer();
  const { renameMode, deleteMode, canDeleteMode } = useCollectionModeOperations();
  const drafts = useTokenDraftStore((state) => state.drafts);
  const openToken = useTokenDraftStore((state) => state.openToken);
  const selectedTokenId = useTokenDraftStore((state) => state.selectedTokenId);

  const collectionTokens = useMemo(() => {
    if (!selectedCollectionId) {
      return [];
    }

    return tokens.filter((token) => token.fileId === selectedCollectionId);
  }, [tokens, selectedCollectionId]);

  const groupFilteredTokens = useMemo(() => {
    if (!selectedGroupSegments) {
      return collectionTokens;
    }

    if (selectedGroupSegments.length === 0) {
      return collectionTokens.filter(
        (token) => getTokenGroupSegments(token.name).length === 0
      );
    }

    return collectionTokens.filter((token) => tokenMatchesGroup(token, selectedGroupSegments));
  }, [collectionTokens, selectedGroupSegments]);

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
    return [...groupFilteredTokens, ...previewRows];
  }, [groupFilteredTokens, createDrafts, tokens]);

  const handleTokenRowActivate = useCallback(
    (rowId: string) => openToken(rowId),
    [openToken],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 flex-1 w-full flex-col">
        {!selectedCollectionId ? null : visibleTokens.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No tokens in this collection yet. Use Add token to create one.
          </div>
        ) : (
          <TokensExplorerDataGrid
            rows={visibleTokens}
            availableModes={availableModes}
            drafts={drafts}
            selectedTokenId={selectedTokenId}
            onTokenRowActivate={handleTokenRowActivate}
            onAddMode={addMode}
            showAddModeControl={Boolean(selectedCollectionId)}
            onRenameMode={renameMode}
            onDeleteMode={deleteMode}
            canDeleteMode={canDeleteMode}
          />
        )}
      </div>
    </div>
  );
}
