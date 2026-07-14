"use client";

import { useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataGrid } from "@/components/data-grid/data-grid";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import {
  getEffectiveTokenRow,
} from "@/lib/tokens/draft-utils";
import { getRowDisplayValue } from "@/lib/tokens/display";
import type { TokenGridRow } from "@/lib/tokens/grid-row";
import type { useTokenDraftStore } from "@/lib/tokens/draft-store";
import { useDataGrid } from "@/hooks/use-data-grid";

function toGridRow(
  token: ImportedTokenRow,
  draft: ReturnType<typeof useTokenDraftStore.getState>["drafts"][string] | undefined,
  resolvedMode: string | null
): TokenGridRow {
  const effectiveRow = getEffectiveTokenRow(token, draft);
  const displayValue = getRowDisplayValue(effectiveRow, resolvedMode);
  const draftStatus =
    draft?.operation === "create"
      ? "create"
      : draft?.operation === "delete"
        ? "delete"
        : draft
          ? "update"
          : null;

  return {
    id: token.id,
    name: token.name,
    typeLabel: token.type ?? "",
    valueText: displayValue.text,
    displayValue,
    draftStatus,
    token,
  };
}

export function TokensExplorerDataGrid({
  rows,
  resolvedMode,
  drafts,
  selectedTokenId,
  onTokenRowActivate,
}: {
  rows: ImportedTokenRow[];
  resolvedMode: string | null;
  drafts: ReturnType<typeof useTokenDraftStore.getState>["drafts"];
  selectedTokenId: string | null;
  onTokenRowActivate: (rowId: string) => void;
}) {
  const gridData = useMemo(
    () =>
      rows.map((token) => toGridRow(token, drafts[token.id], resolvedMode)),
    [rows, drafts, resolvedMode]
  );

  const columns = useMemo<ColumnDef<TokenGridRow>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Token",
        minSize: 240,
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
        size: 140,
        enableResizing: false,
        enablePinning: false,
        enableHiding: false,
        meta: {
          label: "Type",
          cell: { variant: "token-type" },
        },
      },
      {
        id: "value",
        accessorKey: "valueText",
        header: "Value",
        minSize: 280,
        enableResizing: false,
        enablePinning: false,
        enableHiding: false,
        meta: {
          label: "Value",
          cell: { variant: "token-value" },
        },
      },
    ],
    []
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
