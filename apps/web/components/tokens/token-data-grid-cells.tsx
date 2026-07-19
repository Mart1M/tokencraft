"use client";

import {
  ArrowRightLeft,
  Bold,
  CircleGauge,
  Clock3,
  Droplets,
  Hash,
  Image,
  Layers,
  Layers2,
  Maximize,
  Minus,
  MoveHorizontal,
  Palette,
  Pilcrow,
  Radius,
  Ruler,
  Spline,
  Square,
  Tags,
  TextCursorInput,
  ToggleRight,
  Type,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import type { DataGridCellProps } from "@/types/data-grid";
import {
  formatColorAlphaForDisplay,
  resolveDisplayColor,
  type TokenDisplayPart,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import type { TokenGridRow } from "@/lib/tokens/grid-row";
import { cn } from "@/lib/utils";

const TOKEN_TYPE_ICONS: Record<string, LucideIcon> = {
  asset: Image,
  boolean: ToggleRight,
  border: Square,
  borderRadius: Radius,
  color: Palette,
  composition: Layers,
  cubicBezier: Spline,
  dimension: Ruler,
  duration: Clock3,
  fontFamily: Type,
  fontWeight: Bold,
  gradient: Droplets,
  number: Hash,
  opacity: CircleGauge,
  shadow: Layers2,
  sizing: Maximize,
  spacing: MoveHorizontal,
  string: TextCursorInput,
  strokeStyle: Minus,
  transition: ArrowRightLeft,
  typography: Pilcrow,
};

function TokenTypeBadge({ type }: { type: string }) {
  const Icon = TOKEN_TYPE_ICONS[type] ?? Tags;

  return (
    <Badge
      variant="outline"
      className="h-5 gap-1 rounded-md border-border/80 bg-background/70 px-1.5 text-[11px] font-medium leading-none text-foreground/85 shadow-none"
    >
      <Icon className="size-3" aria-hidden="true" />
      {type}
    </Badge>
  );
}

function TokenDisplayPartView({ part }: { part: TokenDisplayPart }) {
  if (part.kind === "alias") {
    return (
      <Badge
        variant="secondary"
        className="rounded-md bg-secondary/80 px-1.5 py-0.5 font-mono text-[11px] font-normal"
      >
        {part.aliasPath}
      </Badge>
    );
  }

  if (part.kind === "color") {
    const alpha = formatColorAlphaForDisplay(part.text);
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-md border border-border/80"
          style={{ backgroundColor: part.color }}
          aria-hidden
        />
        <span className="font-mono text-[13px]">{alpha ? `${alpha.hex} · ${alpha.alphaPercent}%` : part.text}</span>
      </span>
    );
  }

  return <span className="font-mono text-[13px]">{part.text}</span>;
}

function TokenValuePreview({ value, resolvedColor }: { value: TokenDisplayValue; resolvedColor?: string }) {
  const previewColor = resolvedColor ?? resolveDisplayColor(value);
  const alpha = value.kind === "color" ? formatColorAlphaForDisplay(value.text) : null;

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
    <div
      className="flex! min-w-0 items-center gap-2"
      data-slot="grid-cell-content"
    >
      {previewColor ? (
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-md border border-border/80"
          style={{ backgroundColor: previewColor }}
          title={value.text}
          aria-hidden
        />
      ) : null}
      {value.kind === "alias" ? (
        <Badge
          variant="secondary"
          className="max-w-xs rounded-md bg-secondary/80 px-1.5 py-0.5 font-mono text-[11px] font-normal"
        >
          {value.aliasPath ?? value.text}
        </Badge>
      ) : (
        <span className="truncate font-mono text-[13px]">{alpha ? `${alpha.hex} · ${alpha.alphaPercent}%` : value.text}</span>
      )}
    </div>
  );
}

function getTokenGridRow(original: unknown) {
  return original as TokenGridRow;
}

function getRowStateClassName(
  row: TokenGridRow,
  tableMeta: DataGridCellProps<unknown>["tableMeta"],
) {
  return cn(
    tableMeta?.selectedTokenId === row.id && "bg-accent/40",
    row.draftStatus === "delete" && "opacity-60 line-through",
  );
}

function activateRow(
  row: TokenGridRow,
  tableMeta: DataGridCellProps<unknown>["tableMeta"],
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
      <span
        className="inline-flex min-w-0 items-center gap-2 font-mono text-[13px] font-medium tracking-[-0.01em]"
        data-slot="grid-cell-content"
      >
        <span className="truncate">{row.name}</span>
        {row.draftStatus === "create" ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            new
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
        <TokenTypeBadge type={row.typeLabel} />
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </DataGridCellWrapper>
  );
}

export function TokenValueCell<TData>(props: DataGridCellProps<TData>) {
  const row = getTokenGridRow(props.cell.row.original);
  const cellOpts = props.cell.column.columnDef.meta?.cell;
  const modeKey = cellOpts?.variant === "token-value" ? cellOpts.modeKey : undefined;
  const displayValue = modeKey ? row.modeValues[modeKey] : null;

  return (
    <DataGridCellWrapper
      {...props}
      className={cn(getRowStateClassName(row, props.tableMeta))}
      onClick={() => activateRow(row, props.tableMeta)}
    >
      {displayValue ? (
        <TokenValuePreview value={displayValue} resolvedColor={modeKey ? row.resolvedColors[modeKey] : undefined} />
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </DataGridCellWrapper>
  );
}
