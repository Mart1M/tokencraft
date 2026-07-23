"use client";

import { useMemo } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DataGridCellProps } from "@/types/data-grid";
import {
  formatColorAlphaForDisplay,
  resolveDisplayColor,
  type TokenDisplayPart,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import type { TokenGridRow } from "@/lib/tokens/grid-row";
import {
  resolveAliasChain,
  type AliasChainStep,
} from "@/lib/tokens/token-dependencies";
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
  boxShadow: Layers2,
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

function AliasChainTooltipContent({
  steps,
  startPath,
}: {
  steps: AliasChainStep[];
  startPath: string;
}) {
  if (steps.length === 0) {
    return <p className="text-muted-foreground">No reference chain.</p>;
  }

  if (steps.length === 1 && steps[0]?.missing) {
    return <p className="text-destructive">Reference not found</p>;
  }

  const lines: Array<{ key: string; text: string; tone?: "muted" | "error" }> = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];

    if (step.missing) {
      lines.push({
        key: `missing-${index}`,
        text: step.path === startPath ? "Reference not found" : `${step.path} (missing)`,
        tone: "error",
      });
      break;
    }

    // Don't repeat the badge label — only show later hops and the final value.
    if (step.isAlias) {
      if (step.path !== startPath) {
        lines.push({ key: `alias-${index}`, text: step.path });
      }
      continue;
    }

    if (step.path !== startPath) {
      lines.push({ key: `path-${index}`, text: step.path });
    }

    if (step.valueText) {
      lines.push({ key: `value-${index}`, text: step.valueText, tone: "muted" });
    }
  }

  if (lines.length === 0) {
    return <p className="text-muted-foreground">No further references</p>;
  }

  return (
    <div className="flex max-w-xs flex-col gap-1 font-mono text-[11px] leading-relaxed">
      {lines.map((line, index) => (
        <div key={line.key} className="flex flex-col gap-0.5">
          {index > 0 ? (
            <span className="text-muted-foreground/60" aria-hidden>
              ↓
            </span>
          ) : null}
          <span
            className={cn(
              line.tone === "error" && "text-destructive",
              line.tone === "muted" && "text-muted-foreground",
            )}
          >
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function AliasBadge({
  aliasPath,
  mode,
  rows,
  sourceFileId,
  className,
}: {
  aliasPath: string;
  mode?: string;
  rows?: ImportedTokenRow[];
  sourceFileId?: string;
  className?: string;
}) {
  const steps = useMemo(() => {
    if (!rows?.length) {
      return [];
    }

    return resolveAliasChain(aliasPath, rows, mode ?? null, { sourceFileId });
  }, [aliasPath, rows, mode, sourceFileId]);

  const badge = (
    <Badge
      variant="secondary"
      className={cn(
        "max-w-xs rounded-md bg-secondary/80 px-1.5 py-0.5 font-mono text-[11px] font-normal",
        className,
      )}
    >
      {aliasPath}
    </Badge>
  );

  if (!rows?.length || steps.length === 0) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full cursor-default">{badge}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="border border-border bg-background px-2.5 py-2 text-foreground shadow-md"
        arrowClassName="border border-border bg-background fill-background"
      >
        <AliasChainTooltipContent steps={steps} startPath={aliasPath} />
      </TooltipContent>
    </Tooltip>
  );
}

function TokenDisplayPartView({
  part,
  mode,
  rows,
  sourceFileId,
}: {
  part: TokenDisplayPart;
  mode?: string;
  rows?: ImportedTokenRow[];
  sourceFileId?: string;
}) {
  if (part.kind === "alias") {
    return (
      <AliasBadge
        aliasPath={part.aliasPath}
        mode={mode}
        rows={rows}
        sourceFileId={sourceFileId}
      />
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

function TokenValuePreview({
  value,
  resolvedColor,
  mode,
  rows,
  sourceFileId,
}: {
  value: TokenDisplayValue;
  resolvedColor?: string;
  mode?: string;
  rows?: ImportedTokenRow[];
  sourceFileId?: string;
}) {
  const previewColor = resolvedColor ?? resolveDisplayColor(value);
  const alpha = value.kind === "color" ? formatColorAlphaForDisplay(value.text) : null;

  if (value.kind === "composite" && value.parts?.length) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {value.parts.map((part, index) => (
          <TokenDisplayPartView
            key={`${part.kind}-${index}`}
            part={part}
            mode={mode}
            rows={rows}
            sourceFileId={sourceFileId}
          />
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
        <AliasBadge
          aliasPath={value.aliasPath ?? value.text.replace(/^\{|\}$/g, "")}
          mode={mode}
          rows={rows}
          sourceFileId={sourceFileId}
        />
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
        <TokenValuePreview
          value={displayValue}
          resolvedColor={modeKey ? row.resolvedColors[modeKey] : undefined}
          mode={modeKey}
          rows={props.tableMeta?.dependencyRows}
          sourceFileId={row.token.fileId}
        />
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </DataGridCellWrapper>
  );
}
