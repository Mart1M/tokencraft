"use client";

import { useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataGrid } from "@/components/data-grid/data-grid";
import { TokenModeColumnHeader } from "@/components/tokens/token-mode-column-header";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import {
  getDraftsForToken,
  getEffectiveTokenRow,
} from "@/lib/tokens/draft-utils";
import { getRowModeDisplayValue } from "@/lib/tokens/display";
import type { TokenGridRow } from "@/lib/tokens/grid-row";
import type { useTokenDraftStore } from "@/lib/tokens/draft-store";
import { useDataGrid } from "@/hooks/use-data-grid";

function toModeColumnId(mode: string) {
  return `mode-${mode.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function toGridRow(
  token: ImportedTokenRow,
  drafts: ReturnType<typeof useTokenDraftStore.getState>["drafts"],
  availableModes: string[]
): TokenGridRow {
  const tokenDrafts = getDraftsForToken(drafts, token.id);
  const effectiveRow = getEffectiveTokenRow(token, tokenDrafts);
  const modeValues = Object.fromEntries(
    availableModes.map((mode) => [
      mode,
      getRowModeDisplayValue(effectiveRow, mode),
    ]),
  );
  const draftStatus = tokenDrafts.some((draft) => draft.operation === "create")
    ? "create"
    : tokenDrafts.some((draft) => draft.operation === "delete")
      ? "delete"
      : null;

  return {
    id: token.id,
    name: token.name,
    typeLabel: token.type ?? "",
    modeValues,
    draftStatus,
    token,
  };
}

export function TokensExplorerDataGrid({
  rows,
  availableModes,
  drafts,
  selectedTokenId,
  onTokenRowActivate,
  onAddMode,
  showAddModeControl = false,
  onRenameMode,
  onDeleteMode,
  canDeleteMode = true,
}: {
  rows: ImportedTokenRow[];
  availableModes: string[];
  drafts: ReturnType<typeof useTokenDraftStore.getState>["drafts"];
  selectedTokenId: string | null;
  onTokenRowActivate: (rowId: string) => void;
  onAddMode?: (mode: string) => void;
  showAddModeControl?: boolean;
  onRenameMode?: (mode: string, newName: string) => Promise<boolean>;
  onDeleteMode?: (mode: string) => Promise<boolean>;
  canDeleteMode?: boolean;
}) {
  const gridData = useMemo(
    () =>
      rows.map((token) => toGridRow(token, drafts, availableModes)),
    [rows, drafts, availableModes]
  );

  const columns = useMemo<ColumnDef<TokenGridRow>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Token",
        size: 260,
        minSize: 180,
        enableResizing: false,
        enablePinning: false,
        enableHiding: false,
        meta: {
          label: "Token",
          cell: { variant: "token-name" },
        },
      },
      {
        id: "type",
        accessorKey: "typeLabel",
        header: "Type",
        size: 130,
        minSize: 100,
        enableResizing: false,
        enablePinning: false,
        enableHiding: false,
        meta: {
          label: "Type",
          cell: { variant: "token-type" },
        },
      },
      ...availableModes.map((mode, index) => {
        const isLastModeColumn = index === availableModes.length - 1;

        return {
          id: toModeColumnId(mode),
          accessorFn: (row: TokenGridRow) => row.modeValues[mode]?.text ?? "",
          header: () => (
            <TokenModeColumnHeader
              mode={mode}
              showAddControl={isLastModeColumn && showAddModeControl}
              onAddMode={onAddMode}
              onRenameMode={onRenameMode}
              onDeleteMode={onDeleteMode}
              canDeleteMode={canDeleteMode}
            />
          ),
          size: 200,
          minSize: 140,
          enableResizing: false,
          enablePinning: false,
          enableHiding: false,
          meta: {
            label: mode,
            cell: { variant: "token-value" as const, modeKey: mode },
          },
        };
      }),
    ],
    [availableModes, onAddMode, showAddModeControl, onRenameMode, onDeleteMode, canDeleteMode]
  );

  const handleTokenRowActivate = useCallback(
    (rowId: string) => onTokenRowActivate(rowId),
    [onTokenRowActivate]
  );

  const draftsRevision = useMemo(
    () =>
      Object.entries(drafts)
        .map(
          ([id, draft]) =>
            `${id}:${draft.operation ?? "update"}:${draft.valueKind}:${draft.rawValue}`,
        )
        .sort()
        .join("|"),
    [drafts],
  );

  const gridMeta = useMemo(
    () => ({
      selectedTokenId,
      onTokenRowActivate: handleTokenRowActivate,
      draftsRevision,
    }),
    [selectedTokenId, handleTokenRowActivate, draftsRevision],
  );

  const { table, ...dataGridProps } = useDataGrid({
    data: gridData,
    columns,
    readOnly: true,
    selectionMode: "row",
    enableColumnResizing: false,
    enableColumnPinning: false,
    enableHiding: false,
    getRowId: (row) => row.id,
    meta: gridMeta,
  });

  return (
    <DataGrid
      table={table}
      {...dataGridProps}
      fillHeight
      stretchColumns
      className="min-h-0 flex-1 h-full w-full [&_[data-slot=grid]]:rounded-none [&_[data-slot=grid]]:border-x-0"
    />
  );
}
