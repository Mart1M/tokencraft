"use client";

import * as React from "react";

import {
  CheckboxCell,
  DateCell,
  FileCell,
  LongTextCell,
  MultiSelectCell,
  NumberCell,
  SelectCell,
  ShortTextCell,
  UrlCell,
} from "@/components/data-grid/data-grid-cell-variants";
import {
  TokenNameCell,
  TokenTypeCell,
  TokenValueCell,
} from "@/components/tokens/token-data-grid-cells";
import type { DataGridCellProps } from "@/types/data-grid";
import type { TokenGridRow } from "@/lib/tokens/grid-row";

function isTokenGridRow(value: unknown): value is TokenGridRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "modeValues" in value &&
    "draftStatus" in value
  );
}

function tokenGridRowSignature(row: TokenGridRow) {
  const modeValuesSignature = Object.entries(row.modeValues)
    .map(([mode, value]) => `${mode}:${value?.kind ?? ""}:${value?.text ?? ""}`)
    .join(",");

  return `${row.name}\0${row.typeLabel}\0${row.draftStatus ?? ""}\0${modeValuesSignature}`;
}

export const DataGridCell = React.memo(DataGridCellImpl, (prev, next) => {
  // Fast path: check stable primitive props first
  if (prev.isFocused !== next.isFocused) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isSearchMatch !== next.isSearchMatch) return false;
  if (prev.isActiveSearchMatch !== next.isActiveSearchMatch) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.columnId !== next.columnId) return false;
  if (prev.rowHeight !== next.rowHeight) return false;
  if (prev.tableMeta !== next.tableMeta) return false;

  if (prev.cell.row.id !== next.cell.row.id) return false;

  if (prev.cell.row.original !== next.cell.row.original) {
    return false;
  }

  const prevOriginal = prev.cell.row.original;
  const nextOriginal = next.cell.row.original;

  if (isTokenGridRow(prevOriginal) && isTokenGridRow(nextOriginal)) {
    if (tokenGridRowSignature(prevOriginal) !== tokenGridRowSignature(nextOriginal)) {
      return false;
    }
  }

  const accessorKey =
    (prev.cell.column.columnDef as { accessorKey?: string }).accessorKey ??
    prev.columnId;

  const prevRecord = prevOriginal as Record<string, unknown>;
  const nextRecord = nextOriginal as Record<string, unknown>;
  const prevValue = prevRecord[accessorKey];
  const nextValue = nextRecord[accessorKey];

  if (prevValue !== nextValue) {
    return false;
  }

  return true;
}) as typeof DataGridCellImpl;

function DataGridCellImpl<TData>({
  cell,
  tableMeta,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
  isSearchMatch,
  isActiveSearchMatch,
  readOnly,
  rowHeight,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const variant = cellOpts?.variant ?? "text";

  let Comp: React.ComponentType<DataGridCellProps<TData>>;

  switch (variant) {
    case "short-text":
      Comp = ShortTextCell;
      break;
    case "long-text":
      Comp = LongTextCell;
      break;
    case "number":
      Comp = NumberCell;
      break;
    case "url":
      Comp = UrlCell;
      break;
    case "checkbox":
      Comp = CheckboxCell;
      break;
    case "select":
      Comp = SelectCell;
      break;
    case "multi-select":
      Comp = MultiSelectCell;
      break;
    case "date":
      Comp = DateCell;
      break;
    case "file":
      Comp = FileCell;
      break;
    case "token-name":
      Comp = TokenNameCell;
      break;
    case "token-type":
      Comp = TokenTypeCell;
      break;
    case "token-value":
      Comp = TokenValueCell;
      break;

    default:
      Comp = ShortTextCell;
      break;
  }

  return (
    <Comp
      cell={cell}
      tableMeta={tableMeta}
      rowIndex={rowIndex}
      columnId={columnId}
      rowHeight={rowHeight}
      isEditing={isEditing}
      isFocused={isFocused}
      isSelected={isSelected}
      isSearchMatch={isSearchMatch}
      isActiveSearchMatch={isActiveSearchMatch}
      readOnly={readOnly}
    />
  );
}
