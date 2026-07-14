"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";

import { TokenExtensionsEditor } from "@/components/token-extensions-editor";
import { TokenValueEditor } from "@/components/token-value-editor";
import { useTokenExplorer } from "@/components/token-explorer-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import {
  buildCreateDraft,
  buildDraftFromRow,
  buildPendingTokenId,
  formatDraftValue,
  getEditableRawValue,
  getEditableTokenMetadata,
  mergeDraftIntoDisplayValue,
  type TokenDraft,
  type TokenValueKind,
} from "@/lib/tokens/draft-utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { getTokenAliasOptions } from "@/lib/tokens/entries";
import { buildTokenDisplayValue, resolveModeKey } from "@/lib/tokens/display";
import { isCompositeTokenType } from "@/lib/tokens/composite-fields";
import type { TokenExtensions } from "@/lib/tokens/token-metadata";
import { getDefaultLiteralValueForType } from "@/lib/tokens/value-editor";

type PendingTokenEdit = {
  valueKind: TokenValueKind;
  rawValue: string;
  description: string;
  extensions: TokenExtensions | undefined;
};

function serializeExtensions(extensions?: TokenExtensions) {
  if (!extensions) {
    return "";
  }

  return JSON.stringify(
    Object.entries(extensions).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function getPendingTokenEdit(
  token: ImportedTokenRow,
  mode: string | null,
  draft?: TokenDraft,
): PendingTokenEdit {
  const editable = getEditableRawValue(token, mode, draft);
  const metadata = getEditableTokenMetadata(token, draft);

  return {
    valueKind: editable.valueKind,
    rawValue: editable.rawValue,
    description: metadata.description ?? "",
    extensions: metadata.extensions,
  };
}

function pendingEditsEqual(left: PendingTokenEdit, right: PendingTokenEdit) {
  return (
    left.valueKind === right.valueKind &&
    left.rawValue === right.rawValue &&
    left.description === right.description &&
    serializeExtensions(left.extensions) ===
      serializeExtensions(right.extensions)
  );
}

function TokenValuePreview({
  token,
  mode,
  draft,
}: {
  token: ImportedTokenRow;
  mode: string | null;
  draft?: ReturnType<typeof useTokenDraftStore.getState>["drafts"][string];
}) {
  const display = mergeDraftIntoDisplayValue(token, mode, draft);

  if (display.kind === "alias") {
    return (
      <Badge variant="secondary" className="font-mono text-xs font-normal">
        {display.aliasPath ?? display.text}
      </Badge>
    );
  }

  if (display.kind === "color" && display.color) {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block h-5 w-5 rounded border border-border"
          style={{ backgroundColor: display.color }}
        />
        <span className="font-mono text-sm">{display.text}</span>
      </span>
    );
  }

  return <span className="font-mono text-sm">{display.text}</span>;
}

export function TokenEditPanel({ tokens }: { tokens: ImportedTokenRow[] }) {
  const { resolvedMode } = useTokenExplorer();
  const selectedTokenId = useTokenDraftStore((state) => state.selectedTokenId);
  const isPanelOpen = useTokenDraftStore((state) => state.isPanelOpen);
  const panelMode = useTokenDraftStore((state) => state.panelMode);
  const createContext = useTokenDraftStore((state) => state.createContext);
  const drafts = useTokenDraftStore((state) => state.drafts);
  const closePanel = useTokenDraftStore((state) => state.closePanel);
  const clearDraft = useTokenDraftStore((state) => state.clearDraft);
  const setDraft = useTokenDraftStore((state) => state.setDraft);

  const [createPath, setCreatePath] = useState("");
  const [createType, setCreateType] = useState("color");
  const [createValueKind, setCreateValueKind] =
    useState<TokenValueKind>("literal");
  const [createRawValue, setCreateRawValue] = useState("#0066FF");
  const [createDescription, setCreateDescription] = useState("");
  const [createExtensions, setCreateExtensions] = useState<
    TokenExtensions | undefined
  >();
  const [pendingEdit, setPendingEdit] = useState<PendingTokenEdit>({
    valueKind: "literal",
    rawValue: "",
    description: "",
    extensions: undefined,
  });

  const token = useMemo(
    () => tokens.find((row) => row.id === selectedTokenId) ?? null,
    [selectedTokenId, tokens],
  );

  const createPreviewRow = useMemo(() => {
    if (!createContext || !createPath.trim()) {
      return null;
    }

    return {
      id: buildPendingTokenId(createContext.fileId, createPath.trim()),
      fileId: createContext.fileId,
      sourcePath: createContext.sourcePath,
      collectionName: createContext.collectionName,
      name: createPath.trim(),
      type: createType,
      value: createRawValue,
      display: buildTokenDisplayValue(
        formatDraftValue({
          valueKind: createValueKind,
          rawValue: createRawValue,
          type: createType,
        }),
        createType,
      ),
    } satisfies ImportedTokenRow;
  }, [createContext, createPath, createRawValue, createType, createValueKind]);

  const activeMode =
    token?.modes && resolvedMode
      ? resolveModeKey(token.modes, resolvedMode)
      : null;
  const draft = selectedTokenId ? drafts[selectedTokenId] : undefined;
  const savedEdit = token
    ? getPendingTokenEdit(token, activeMode, draft)
    : null;
  const hasPendingChanges =
    savedEdit !== null && !pendingEditsEqual(pendingEdit, savedEdit);
  const previewDraft =
    token && (hasPendingChanges || draft)
      ? buildDraftFromRow(
          token,
          activeMode,
          pendingEdit.valueKind,
          pendingEdit.rawValue,
          draft?.operation === "delete" ? "delete" : "update",
          {
            description: pendingEdit.description,
            extensions: pendingEdit.extensions,
          },
        )
      : draft;
  const aliasOptions = useMemo(
    () => getTokenAliasOptions(tokens, token?.id),
    [tokens, token?.id],
  );

  useEffect(() => {
    if (panelMode === "create") {
      setCreatePath("");
      setCreateType("color");
      setCreateValueKind("literal");
      setCreateRawValue(getDefaultLiteralValueForType("color"));
      setCreateDescription("");
      setCreateExtensions(undefined);
    }
  }, [panelMode, createContext?.fileId]);

  useEffect(() => {
    if (!token || panelMode !== "edit") {
      return;
    }

    setPendingEdit(getPendingTokenEdit(token, activeMode, draft));
  }, [token?.id, activeMode, panelMode, selectedTokenId]);

  useEffect(() => {
    if (panelMode !== "create" || createValueKind !== "literal") {
      return;
    }

    setCreateRawValue(getDefaultLiteralValueForType(createType));
  }, [createType, createValueKind, panelMode]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePanel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel]);

  if (!isPanelOpen) {
    return null;
  }

  if (panelMode === "create" && createContext) {
    const pendingId = createPath.trim()
      ? buildPendingTokenId(createContext.fileId, createPath.trim())
      : null;

    function saveCreateDraft() {
      if (!createPath.trim()) {
        return;
      }

      setDraft(
        buildCreateDraft({
          fileId: createContext!.fileId,
          path: createPath.trim(),
          type: createType,
          mode: null,
          valueKind: createValueKind,
          rawValue: createRawValue,
          description: createDescription,
          extensions: createExtensions,
        }),
      );
      closePanel();
    }

    return (
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[420px] flex-col border-l bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              New token
            </p>
            <h2 className="truncate text-sm font-medium">
              {createContext.collectionName}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
            <X size={16} />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="create-token-path">
              Token path
            </label>
            <Input
              id="create-token-path"
              value={createPath}
              onChange={(event) => setCreatePath(event.target.value)}
              placeholder="color.primary.500"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="create-token-type">
              Type
            </label>
            <Input
              id="create-token-type"
              value={createType}
              onChange={(event) => setCreateType(event.target.value)}
              placeholder="color"
              className="font-mono"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Value type</p>
            <div className="inline-flex rounded-lg border p-1">
              <Button
                type="button"
                size="sm"
                variant={createValueKind === "literal" ? "secondary" : "ghost"}
                onClick={() => setCreateValueKind("literal")}
              >
                Literal
              </Button>
              <Button
                type="button"
                size="sm"
                variant={createValueKind === "alias" ? "secondary" : "ghost"}
                onClick={() => setCreateValueKind("alias")}
              >
                Alias
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="create-token-value">
              {createValueKind === "alias"
                ? "Alias path"
                : isCompositeTokenType(createType)
                  ? "Value fields"
                  : "Value"}
            </label>
            <TokenValueEditor
              id="create-token-value"
              type={createType}
              valueKind={createValueKind}
              rawValue={createRawValue}
              aliasOptions={aliasOptions}
              onValueKindChange={setCreateValueKind}
              onRawValueChange={setCreateRawValue}
            />
          </div>

          {createPreviewRow ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview</p>
              <TokenValuePreview token={createPreviewRow} mode={null} />
            </div>
          ) : null}

          <Separator />

          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="create-token-description"
            >
              Description
            </label>
            <Textarea
              id="create-token-description"
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              placeholder="Optional token description"
              className="min-h-20 resize-y"
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Extensions</p>
              <p className="text-xs text-muted-foreground">
                Optional DTCG{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  $extensions
                </code>{" "}
                metadata.
              </p>
            </div>
            <TokenExtensionsEditor
              value={createExtensions}
              onChange={setCreateExtensions}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-4">
          <Button
            type="button"
            size="sm"
            onClick={saveCreateDraft}
            disabled={!createPath.trim()}
          >
            Add to draft
          </Button>
          {pendingId && drafts[pendingId] ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => clearDraft(pendingId)}
            >
              <RotateCcw size={14} />
              Discard
            </Button>
          ) : null}
        </div>
      </aside>
    );
  }

  if (!token) {
    return null;
  }

  function applyChanges() {
    if (!hasPendingChanges) {
      return;
    }

    setDraft(
      buildDraftFromRow(
        token!,
        activeMode,
        pendingEdit.valueKind,
        pendingEdit.rawValue,
        "update",
        {
          description: pendingEdit.description,
          extensions: pendingEdit.extensions,
        },
      ),
    );
  }

  function discardChanges() {
    if (selectedTokenId && draft) {
      clearDraft(selectedTokenId);
    }

    setPendingEdit(getPendingTokenEdit(token!, activeMode, undefined));
  }

  function deleteToken() {
    if (draft?.operation === "create") {
      clearDraft(token!.id);
      closePanel();
      return;
    }

    setDraft({
      tokenId: token!.id,
      fileId: token!.fileId,
      path: token!.name,
      ...(token!.type ? { type: token!.type } : {}),
      mode: activeMode,
      valueKind: savedEdit!.valueKind,
      rawValue: savedEdit!.rawValue,
      description: savedEdit!.description,
      ...(savedEdit!.extensions ? { extensions: savedEdit!.extensions } : {}),
      operation: "delete",
    });
    closePanel();
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-[420px] flex-col border-l bg-background shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Token
          </p>
          <h2 className="truncate font-mono text-sm font-medium">
            {token.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {token.type ? <Badge variant="outline">{token.type}</Badge> : null}
            {activeMode ? (
              <Badge variant="secondary" className="capitalize">
                {activeMode}
              </Badge>
            ) : null}
            {draft?.operation === "delete" ? (
              <Badge variant="outline" className="text-destructive">
                deleted
              </Badge>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
          <X size={16} />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {draft?.operation !== "delete" ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview</p>
              <TokenValuePreview
                token={token}
                mode={activeMode}
                draft={previewDraft}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Value type</p>
              <div className="inline-flex rounded-lg border p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    pendingEdit.valueKind === "literal" ? "secondary" : "ghost"
                  }
                  onClick={() =>
                    setPendingEdit((current) => ({
                      ...current,
                      valueKind: "literal",
                    }))
                  }
                >
                  Literal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    pendingEdit.valueKind === "alias" ? "secondary" : "ghost"
                  }
                  onClick={() =>
                    setPendingEdit((current) => ({
                      ...current,
                      valueKind: "alias",
                    }))
                  }
                >
                  Alias
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="token-value-input"
              >
                {pendingEdit.valueKind === "alias"
                  ? "Alias path"
                  : token.type && isCompositeTokenType(token.type)
                    ? "Value fields"
                    : "Value"}
              </label>
              {pendingEdit.valueKind === "alias" ? (
                <div className="space-y-2">
                  <TokenValueEditor
                    id="token-value-input"
                    type={token.type}
                    valueKind={pendingEdit.valueKind}
                    rawValue={pendingEdit.rawValue}
                    raw={token.raw}
                    aliasOptions={aliasOptions}
                    onValueKindChange={(valueKind) =>
                      setPendingEdit((current) => ({ ...current, valueKind }))
                    }
                    onRawValueChange={(rawValue) =>
                      setPendingEdit((current) => ({ ...current, rawValue }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Pick a token from any imported collection. The alias is
                    stored as{" "}
                    <code className="rounded bg-muted px-1 py-0.5">{`{token.path}`}</code>
                    .
                  </p>
                </div>
              ) : (
                <TokenValueEditor
                  id="token-value-input"
                  type={token.type}
                  valueKind={pendingEdit.valueKind}
                  rawValue={pendingEdit.rawValue}
                  raw={token.raw}
                  aliasOptions={aliasOptions}
                  onValueKindChange={(valueKind) =>
                    setPendingEdit((current) => ({ ...current, valueKind }))
                  }
                  onRawValueChange={(rawValue) =>
                    setPendingEdit((current) => ({ ...current, rawValue }))
                  }
                />
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="token-description"
              >
                Description
              </label>
              <Textarea
                id="token-description"
                value={pendingEdit.description}
                onChange={(event) =>
                  setPendingEdit((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional token description"
                className="min-h-20 resize-y"
              />
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Extensions</p>
                <p className="text-xs text-muted-foreground">
                  Optional DTCG{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    $extensions
                  </code>{" "}
                  metadata.
                </p>
              </div>
              <TokenExtensionsEditor
                value={pendingEdit.extensions}
                onChange={(extensions) =>
                  setPendingEdit((current) => ({ ...current, extensions }))
                }
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This token is marked for deletion. Commit to save, then push to
            remove it from GitHub.
          </p>
        )}

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          Source file:{" "}
          <span className="font-mono text-foreground">{token.sourcePath}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-4">
        {draft?.operation !== "delete" ? (
          <Button
            type="button"
            size="sm"
            onClick={applyChanges}
            disabled={!hasPendingChanges}
          >
            Apply
          </Button>
        ) : null}
        {hasPendingChanges || draft ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={discardChanges}
          >
            <RotateCcw size={14} />
            Discard changes
          </Button>
        ) : null}
        {draft?.operation === "delete" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (selectedTokenId) {
                clearDraft(selectedTokenId);
                setPendingEdit(getPendingTokenEdit(token, activeMode, undefined));
              }
            }}
          >
            <RotateCcw size={14} />
            Undo delete
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deleteToken}
          >
            <Trash2 size={14} />
            Delete token
          </Button>
        )}
      </div>
    </aside>
  );
}
