"use client";

import { FileDiff, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import type { TokenDraft } from "@/lib/tokens/draft-utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

type Collection = { id: string; name: string; path: string };
type DiffKind = "add" | "remove" | "context";

function DiffLine({ kind, children }: { kind: DiffKind; children: React.ReactNode }) {
  const prefix = kind === "add" ? "+" : kind === "remove" ? "−" : " ";

  return (
    <div
      className={
        kind === "add"
          ? "bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
          : kind === "remove"
            ? "bg-red-500/10 text-red-950 dark:text-red-200"
            : "text-muted-foreground"
      }
    >
      <code className="grid grid-cols-[1.5rem_minmax(0,1fr)] px-3 py-1 text-xs leading-5">
        <span className="select-none text-center opacity-70">{prefix}</span>
        <span className="min-w-0 break-all whitespace-pre-wrap">{children}</span>
      </code>
    </div>
  );
}

function metadataLines(draft: TokenDraft) {
  return [
    ...(draft.description !== undefined ? [`$description: ${JSON.stringify(draft.description)}`] : []),
    ...(draft.extensions !== undefined ? [`$extensions: ${JSON.stringify(draft.extensions)}`] : []),
    ...(draft.colorModifier !== undefined ? [`$extensions.tokencraft.modify: ${JSON.stringify(draft.colorModifier)}`] : []),
  ];
}

function TokenDiff({ draft, token }: { draft: TokenDraft; token?: ImportedTokenRow }) {
  const before = token?.display?.text ?? token?.value ?? "";
  const after = draft.valueKind === "alias" ? `{${draft.rawValue}}` : draft.rawValue;
  const isAdded = draft.operation === "create";
  const isDeleted = draft.operation === "delete";

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <code className="block truncate text-xs font-medium">{draft.path}</code>
          <span className="text-[11px] text-muted-foreground">{draft.mode ?? "Default"}</span>
        </div>
      </div>
      <div className="border-b bg-muted/30 px-3 py-1 font-mono text-[11px] text-muted-foreground">
        @@ {draft.operation === "create" ? "new token" : draft.operation === "delete" ? "deleted token" : "value"} @@
      </div>
      {isAdded ? null : <DiffLine kind="remove">$value: {before}</DiffLine>}
      {isDeleted ? null : <DiffLine kind="add">$value: {after}</DiffLine>}
      {metadataLines(draft).map((line) => <DiffLine key={line} kind="add">{line}</DiffLine>)}
    </div>
  );
}

function CompactChange({
  children,
  onDiscard,
}: {
  children: React.ReactNode;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs">
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <Button type="button" size="icon-xs" variant="ghost" onClick={onDiscard} aria-label="Discard change">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function getWorkspaceChangeCount(state: {
  drafts: Record<string, TokenDraft>;
  pendingCollectionDeletes: string[];
  pendingCollectionCreates: Record<string, unknown>;
  pendingModeChanges: Record<string, unknown>;
}) {
  return Object.keys(state.drafts).length + state.pendingCollectionDeletes.length + Object.keys(state.pendingCollectionCreates).length + Object.keys(state.pendingModeChanges).length;
}

export function TokenChangesReview({
  open,
  onOpenChange,
  tokens,
  collections,
  onSave,
  status,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: ImportedTokenRow[];
  collections: Collection[];
  onSave: () => Promise<void>;
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
}) {
  const drafts = useTokenDraftStore((state) => state.drafts);
  const pendingCollectionDeletes = useTokenDraftStore((state) => state.pendingCollectionDeletes);
  const pendingCollectionCreates = useTokenDraftStore((state) => state.pendingCollectionCreates);
  const pendingModeChanges = useTokenDraftStore((state) => state.pendingModeChanges);
  const clearDraftByKey = useTokenDraftStore((state) => state.clearDraftByKey);
  const unmarkCollectionForDelete = useTokenDraftStore((state) => state.unmarkCollectionForDelete);
  const clearCollectionCreate = useTokenDraftStore((state) => state.clearCollectionCreate);
  const clearModeChange = useTokenDraftStore((state) => state.clearModeChange);
  const clearAllDrafts = useTokenDraftStore((state) => state.clearAllDrafts);

  const collectionName = (id: string) => collections.find((collection) => collection.id === id)?.name ?? "Unknown collection";
  const draftEntries = Object.entries(drafts);
  const changeCount = getWorkspaceChangeCount({ drafts, pendingCollectionDeletes, pendingCollectionCreates, pendingModeChanges });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-2xl shadow-xl">
        <SheetHeader className="flex-row items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <FileDiff className="size-4 text-muted-foreground" />
            <SheetTitle>Changes</SheetTitle>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{changeCount}</span>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close review"><X className="size-4" /></Button>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {draftEntries.map(([key, draft]) => {
            const token = tokens.find((candidate) => candidate.id === draft.tokenId);
            return (
              <section key={key} className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs text-muted-foreground">{collectionName(draft.fileId)}</span>
                  <Button type="button" size="icon-xs" variant="ghost" onClick={() => clearDraftByKey(key)} aria-label={`Discard ${draft.path}`}><Trash2 className="size-3.5" /></Button>
                </div>
                <TokenDiff draft={draft} token={token} />
              </section>
            );
          })}

          {Object.values(pendingCollectionCreates).map((change) => (
            <CompactChange key={change.id} onDiscard={() => clearCollectionCreate(change.id)}><span className="text-emerald-600">+ </span>collection {change.path}</CompactChange>
          ))}
          {pendingCollectionDeletes.map((id) => (
            <CompactChange key={id} onDiscard={() => unmarkCollectionForDelete(id)}><span className="text-red-600">− </span>collection {collectionName(id)}</CompactChange>
          ))}
          {Object.values(pendingModeChanges).map((change) => (
            <CompactChange key={change.id} onDiscard={() => clearModeChange(change.id)}>
              <span className={change.action === "delete" ? "text-red-600" : "text-emerald-600"}>{change.action === "delete" ? "− " : "+ "}</span>
              mode {collectionName(change.fileId)}: {change.oldMode ?? change.mode}{change.newMode ? ` → ${change.newMode}` : ""}
            </CompactChange>
          ))}

          {!changeCount ? <p className="py-8 text-center text-sm text-muted-foreground">No changes.</p> : null}
          {error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <SheetFooter className="justify-between border-t px-5 py-3">
          <Button type="button" size="sm" variant="ghost" disabled={!changeCount || status === "saving"} onClick={clearAllDrafts}>Discard all</Button>
          <Button type="button" size="sm" disabled={!changeCount || status === "saving"} onClick={() => void onSave()}>{status === "saving" ? "Saving…" : "Save changes"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
