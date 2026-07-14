"use client";

import { Badge } from "@/components/ui/badge";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import type { DataGridCellProps } from "@/types/data-grid";
import type { TokenDisplayPart, TokenDisplayValue } from "@/lib/tokens/display";
import type { TokenGridRow } from "@/lib/tokens/grid-row";
import { cn } from "@/lib/utils";

function TokenDisplayPartView({ part }: { part: TokenDisplayPart }) {
  if (part.kind === "alias") {
    return (
      <Badge variant="secondary" className="font-mono text-xs font-normal">
        {part.aliasPath}
      </Badge>
    );
  }

  if (part.kind === "color") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-4 w-4 shrink-0 rounded border border-border"
          style={{ backgroundColor: part.color }}
          aria-hidden
        />
        <span className="font-mono text-sm">{part.text}</span>
      </span>
    );
  }

  return <span className="font-mono text-sm">{part.text}</span>;
}

function TokenValuePreview({ value }: { value: TokenDisplayValue }) {
  if (value.kind === "composite" && value.parts?.length) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {value.parts.map((part, index) => (
          <TokenDisplayPartView key={`${part.kind}-${index}`} part={part} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {value.kind === "color" && value.color ? (
        <span
          className="inline-block h-4 w-4 shrink-0 rounded border border-border"
          style={{ backgroundColor: value.color }}
          aria-hidden
        />
      ) : null}
      {value.kind === "alias" ? (
        <Badge variant="secondary" className="max-w-xs truncate font-mono text-xs font-normal">
          {value.aliasPath ?? value.text}
        </Badge>
      ) : (
        <span className="truncate font-mono text-sm">{value.text}</span>
      )}
    </div>
  );
}

function getTokenGridRow(original: unknown) {
  return original as TokenGridRow;
}

function getRowStateClassName(
  row: TokenGridRow,
  tableMeta: DataGridCellProps<unknown>["tableMeta"]
) {
  return cn(
    tableMeta?.selectedTokenId === row.id && "bg-accent/40",
    row.draftStatus === "delete" && "opacity-60 line-through",
    row.draftStatus && row.draftStatus !== "delete" && "border-l-2 border-l-amber-500"
  );
}

function activateRow(
  row: TokenGridRow,
  tableMeta: DataGridCellProps<unknown>["tableMeta"]
) {
  tableMeta?.onTokenRowActivate?.(row.id);
}

export function TokenNameCell<TData>(props: DataGridCellProps<TData>) {
  const row = getTokenGridRow(props.cell.row.original);

  return (
    <DataGridCellWrapper
      {...props}
      className={getRowStateClassName(row, props.tableMeta)}
      onClick={() => activateRow(row, props.tableMeta)}
    >
      <span className="inline-flex min-w-0 items-center gap-2 font-mono text-sm">
        <span className="truncate">{row.name}</span>
        {row.draftStatus === "create" ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            new
          </span>
        ) : null}
        {row.draftStatus === "update" ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
            edited
          </span>
        ) : null}
        {row.draftStatus === "delete" ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
            deleted
          </span>
        ) : null}
      </span>
    </DataGridCellWrapper>
  );
}

export function TokenTypeCell<TData>(props: DataGridCellProps<TData>) {
  const row = getTokenGridRow(props.cell.row.original);

  return (
    <DataGridCellWrapper
      {...props}
      className={getRowStateClassName(row, props.tableMeta)}
      onClick={() => activateRow(row, props.tableMeta)}
    >
      {row.typeLabel ? (
        <Badge variant="outline">{row.typeLabel}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </DataGridCellWrapper>
  );
}

export function TokenValueCell<TData>(props: DataGridCellProps<TData>) {
  const row = getTokenGridRow(props.cell.row.original);

  return (
    <DataGridCellWrapper
      {...props}
      className={cn("max-w-md", getRowStateClassName(row, props.tableMeta))}
      onClick={() => activateRow(row, props.tableMeta)}
    >
      <TokenValuePreview value={row.displayValue} />
    </DataGridCellWrapper>
  );
}
