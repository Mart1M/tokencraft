"use client";

import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TokenDraft } from "@/lib/tokens/draft-utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import {
  getTokenDependencyGraph,
  type TokenDependency,
} from "@/lib/tokens/token-dependencies";

function DependencyRow({
  dependency,
  onOpen,
}: {
  dependency: TokenDependency;
  onOpen: (token: ImportedTokenRow) => void;
}) {
  if (!dependency.token) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
        Unknown reference: <code>{`{${dependency.path}}`}</code>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full justify-start gap-2 px-2.5 py-2 text-left"
      onClick={() => onOpen(dependency.token!)}
    >
      <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{dependency.path}</span>
      <span className="max-w-20 shrink truncate text-[10px] text-muted-foreground">
        {dependency.token.collectionName}
      </span>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {dependency.token.type ?? "token"}
      </Badge>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {dependency.mode ?? "Default"}
      </span>
    </Button>
  );
}

export function TokenDependencies({
  token,
  tokens,
  drafts,
  mode,
  onOpenToken,
}: {
  token: ImportedTokenRow;
  tokens: ImportedTokenRow[];
  drafts: Record<string, TokenDraft>;
  mode: string | null;
  onOpenToken: (token: ImportedTokenRow) => void;
}) {
  const graph = getTokenDependencyGraph(token, tokens, drafts, mode);

  return (
    <section className="space-y-3 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Dependencies</h3>
        <p className="text-xs text-muted-foreground">
          Links across all modes, including unsaved changes.
        </p>
      </div>

      {graph.cycle ? (
        <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>Reference cycle detected.</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowUpRight className="size-3.5" /> Uses ({graph.outgoing.length})
        </div>
        {graph.outgoing.length ? (
          <div className="divide-y rounded-md border">{graph.outgoing.map((dependency) => (
            <DependencyRow key={`${dependency.path}-${dependency.mode}`} dependency={dependency} onOpen={onOpenToken} />
          ))}</div>
        ) : (
          <p className="text-xs text-muted-foreground">No token references.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowDownLeft className="size-3.5" /> Used by ({graph.incoming.length})
        </div>
        {graph.incoming.length ? (
          <div className="divide-y rounded-md border">{graph.incoming.map((dependency) => (
            <DependencyRow key={`${dependency.path}-${dependency.mode}`} dependency={dependency} onOpen={onOpenToken} />
          ))}</div>
        ) : (
          <p className="text-xs text-muted-foreground">No tokens reference this token.</p>
        )}
      </div>
    </section>
  );
}
