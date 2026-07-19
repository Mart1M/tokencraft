"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";

import { TokenExtensionsEditor } from "@/components/token-extensions-editor";
import { TokenDependencies } from "@/components/token-dependencies";
import { TokenColorModifierEditor } from "@/components/token-color-modifier-editor";
import { TokenTypeCombobox } from "@/components/token-type-combobox";
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
  getDraftKey,
  getDraftsForToken,
  getEditableRawValue,
  getEditableTokenMetadata,
  resolveStorageMode,
  type TokenDraft,
  type TokenValueKind,
} from "@/lib/tokens/draft-utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { getTokenAliasOptions } from "@/lib/tokens/entries";
import { isCompositeTokenType } from "@/lib/tokens/composite-fields";
import type { TokenExtensions } from "@/lib/tokens/token-metadata";
import {
  createDefaultColorModifier,
  type TokenColorModifier,
} from "@/lib/tokens/color-modifier";
import { buildTokenDisplayValue } from "@/lib/tokens/display";
import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import { toStoredTokenRawValue } from "@/lib/tokens/raw-value";
import { resolveColorModifierPreview } from "@/lib/tokens/color-modifier-preview";
import { getDefaultLiteralValueForType } from "@/lib/tokens/value-editor";
import { getTokenGroupSegments } from "@/lib/tokens/token-tree";

type PendingTokenEdit = {
  valueKind: TokenValueKind;
  rawValue: string;
  description: string;
  extensions: TokenExtensions | undefined;
  colorModifier: TokenColorModifier | undefined;
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

function serializeColorModifier(modifier?: TokenColorModifier) {
  return modifier ? JSON.stringify(modifier) : "";
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
    colorModifier: metadata.colorModifier,
  };
}

type PendingTokenMetadata = {
  description: string;
  extensions: TokenExtensions | undefined;
  colorModifier: TokenColorModifier | undefined;
};

function buildPendingEditsByMode(
  token: ImportedTokenRow,
  modes: string[],
  tokenDrafts: TokenDraft[],
): Record<string, PendingTokenEdit> {
  return Object.fromEntries(
    modes.map((mode) => {
      const storageMode = resolveStorageMode(token, mode);
      const draft = tokenDrafts.find((entry) => entry.mode === storageMode);

      return [mode, getPendingTokenEdit(token, storageMode, draft)];
    }),
  );
}

function pendingEditsEqual(left: PendingTokenEdit, right: PendingTokenEdit) {
  return (
    left.valueKind === right.valueKind &&
    left.rawValue === right.rawValue &&
    left.description === right.description &&
    serializeExtensions(left.extensions) ===
      serializeExtensions(right.extensions) &&
    serializeColorModifier(left.colorModifier) === serializeColorModifier(right.colorModifier)
  );
}

function metadataEqual(
  left: PendingTokenMetadata,
  right: PendingTokenMetadata,
) {
  return (
    left.description === right.description &&
    serializeExtensions(left.extensions) ===
      serializeExtensions(right.extensions) &&
    serializeColorModifier(left.colorModifier) === serializeColorModifier(right.colorModifier)
  );
}

function buildModifierPreviewToken(
  token: ImportedTokenRow,
  valueKind: TokenValueKind,
  rawValue: string,
  colorModifier?: TokenColorModifier,
): ImportedTokenRow {
  const value = valueKind === "alias" ? `{${rawValue}}` : rawValue;

  return {
    ...token,
    value,
    display: buildTokenDisplayValue(value, "color"),
    colorModifier,
  };
}

/** Creates the same editable row shape for a token that only exists in drafts. */
function buildCreatedTokenRow(
  draft: TokenDraft,
  tokens: ImportedTokenRow[],
): ImportedTokenRow {
  const collection = tokens.find((candidate) => candidate.fileId === draft.fileId);
  const formatted = formatDraftValue(draft);
  const raw = toStoredTokenRawValue(formatted);

  return {
    id: draft.tokenId,
    fileId: draft.fileId,
    sourcePath: collection?.sourcePath ?? "",
    collectionName: collection?.collectionName ?? "Collection",
    name: draft.path,
    ...(draft.type ? { type: draft.type } : {}),
    value: formatDtcgTokenValue(formatted, draft.type),
    display: buildTokenDisplayValue(formatted, draft.type),
    ...(raw !== undefined ? { raw } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.extensions ? { extensions: draft.extensions } : {}),
    ...(draft.colorModifier ? { colorModifier: draft.colorModifier } : {}),
  };
}

export function TokenEditPanel({ tokens }: { tokens: ImportedTokenRow[] }) {
  const { availableModes, setSelectedCollectionId, setSelectedGroupSegments } = useTokenExplorer();
  const selectedTokenId = useTokenDraftStore((state) => state.selectedTokenId);
  const isPanelOpen = useTokenDraftStore((state) => state.isPanelOpen);
  const panelMode = useTokenDraftStore((state) => state.panelMode);
  const panelEditScope = useTokenDraftStore((state) => state.panelEditScope);
  const panelFocusMode = useTokenDraftStore((state) => state.panelFocusMode);
  const createContext = useTokenDraftStore((state) => state.createContext);
  const drafts = useTokenDraftStore((state) => state.drafts);
  const closePanel = useTokenDraftStore((state) => state.closePanel);
  const clearDraft = useTokenDraftStore((state) => state.clearDraft);
  const setDraft = useTokenDraftStore((state) => state.setDraft);
  const openToken = useTokenDraftStore((state) => state.openToken);

  const [createPath, setCreatePath] = useState("");
  const [createType, setCreateType] = useState("color");
  const [createValueKind, setCreateValueKind] =
    useState<TokenValueKind>("literal");
  const [createRawValue, setCreateRawValue] = useState("#0066FF");
  const [createDescription, setCreateDescription] = useState("");
  const [createExtensions, setCreateExtensions] = useState<
    TokenExtensions | undefined
  >();
  const [createColorModifier, setCreateColorModifier] = useState<TokenColorModifier>();
  const [pendingEdit, setPendingEdit] = useState<PendingTokenEdit>({
    valueKind: "literal",
    rawValue: "",
    description: "",
    extensions: undefined,
    colorModifier: undefined,
  });
  const [pendingEditsByMode, setPendingEditsByMode] = useState<
    Record<string, PendingTokenEdit>
  >({});
  const [pendingMetadata, setPendingMetadata] = useState<PendingTokenMetadata>({
    description: "",
    extensions: undefined,
    colorModifier: undefined,
  });

  const token = useMemo(() => {
    const savedToken = tokens.find((row) => row.id === selectedTokenId);

    if (savedToken) {
      return savedToken;
    }

    const createdDraft = Object.values(drafts).find(
      (entry) => entry.tokenId === selectedTokenId && entry.operation === "create",
    );

    return createdDraft ? buildCreatedTokenRow(createdDraft, tokens) : null;
  }, [drafts, selectedTokenId, tokens]);

  const tokenDrafts = useMemo(
    () => (selectedTokenId ? getDraftsForToken(drafts, selectedTokenId) : []),
    [drafts, selectedTokenId],
  );

  const activeMode =
    panelEditScope === "single" && panelFocusMode && token
      ? resolveStorageMode(token, panelFocusMode)
      : null;

  const draft =
    panelEditScope === "single" && selectedTokenId
      ? drafts[
          getDraftKey({
            tokenId: selectedTokenId,
            mode: activeMode,
          })
        ]
      : tokenDrafts.find((entry) => entry.operation === "delete");

  const savedEdit =
    panelEditScope === "single" && token
      ? getPendingTokenEdit(token, activeMode, draft)
      : null;

  const savedEditsByMode = useMemo(
    () =>
      token ? buildPendingEditsByMode(token, availableModes, tokenDrafts) : {},
    [token, availableModes, tokenDrafts],
  );

  const savedMetadata = useMemo(
    () =>
      token
        ? getEditableTokenMetadata(token, tokenDrafts[0])
        : { description: "", extensions: undefined, colorModifier: undefined },
    [token, tokenDrafts],
  );

  const hasPendingValueChanges = !token
    ? false
    : panelEditScope === "all"
      ? availableModes.some((mode) => {
          const saved = savedEditsByMode[mode];
          const pending =
            pendingEditsByMode[mode] ??
            getPendingTokenEdit(token, resolveStorageMode(token, mode));

          return saved
            ? pending.valueKind !== saved.valueKind ||
                pending.rawValue !== saved.rawValue
            : Boolean(pending.rawValue);
        })
      : savedEdit !== null &&
        (pendingEdit.valueKind !== savedEdit.valueKind ||
          pendingEdit.rawValue !== savedEdit.rawValue);

  const hasPendingMetadataChanges = !metadataEqual(
    pendingMetadata,
    savedMetadata,
  );

  const hasPendingChanges =
    panelEditScope === "all"
      ? hasPendingValueChanges || hasPendingMetadataChanges
      : hasPendingValueChanges || hasPendingMetadataChanges;

  const aliasOptions = useMemo(
    () => getTokenAliasOptions(tokens, token?.id),
    [tokens, token?.id],
  );

  function openDependency(target: ImportedTokenRow) {
    setSelectedCollectionId(target.fileId);
    setSelectedGroupSegments(getTokenGroupSegments(target.name));
    openToken(target.id);
  }
  const colorAliasOptions = useMemo(
    () => aliasOptions.filter((option) => option.type === "color"),
    [aliasOptions],
  );

  useEffect(() => {
    if (panelMode === "create") {
      setCreatePath("");
      setCreateType("color");
      setCreateValueKind("literal");
      setCreateRawValue(getDefaultLiteralValueForType("color"));
      setCreateDescription("");
      setCreateExtensions(undefined);
      setCreateColorModifier(undefined);
    }
  }, [panelMode, createContext?.fileId]);

  useEffect(() => {
    if (!token || panelMode !== "edit") {
      return;
    }

    if (panelEditScope === "all") {
      setPendingEditsByMode(
        buildPendingEditsByMode(token, availableModes, tokenDrafts),
      );
      setPendingMetadata(getEditableTokenMetadata(token, tokenDrafts[0]));
      return;
    }

    setPendingEdit(getPendingTokenEdit(token, activeMode, draft));
    setPendingMetadata(getEditableTokenMetadata(token, draft));
  }, [
    token?.id,
    activeMode,
    panelMode,
    panelEditScope,
    panelFocusMode,
    selectedTokenId,
    draft,
    tokenDrafts,
    availableModes,
  ]);

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
          colorModifier: createColorModifier,
        }),
      );
      closePanel();
    }

    return (
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col border-l bg-background shadow-xl">
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
            <TokenTypeCombobox
              id="create-token-type"
              value={createType}
              onValueChange={(type) => {
                setCreateType(type);
                if (type !== "color") {
                  setCreateColorModifier(undefined);
                }
              }}
            />
          </div>

          <Separator />

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
              hasColorModifier={Boolean(createColorModifier)}
              onColorModifierClick={() => {
                if (createColorModifier) {
                  return;
                }

                setCreateColorModifier(createDefaultColorModifier());
              }}
            />
          </div>

          {createType === "color" ? (
            <TokenColorModifierEditor
              value={createColorModifier}
              colorAliases={colorAliasOptions}
              rows={tokens}
              previewToken={buildModifierPreviewToken(
                {
                  id: "create-preview",
                  fileId: createContext.fileId,
                  sourcePath: "",
                  collectionName: createContext.collectionName,
                  name: createPath.trim() || "__new_color__",
                  type: "color",
                  value: createRawValue,
                },
                createValueKind,
                createRawValue,
                createColorModifier,
              )}
              onChange={setCreateColorModifier}
            />
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
              key={`create:${createContext.fileId}`}
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
            disabled={!createPath.trim() || Boolean(createColorModifier && (!createRawValue.trim() || (createColorModifier.type === "mix" && !createColorModifier.color)))}
          >
            Add
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

  const modifierPreviewMode =
    panelEditScope === "all"
      ? availableModes.find((mode) => mode.toLowerCase() === "default") ?? availableModes[0] ?? "Default"
      : panelFocusMode ?? "Default";
  const modifierPreviewEdit =
    panelEditScope === "all"
      ? pendingEditsByMode[modifierPreviewMode] ??
        getPendingTokenEdit(token, resolveStorageMode(token, modifierPreviewMode))
      : pendingEdit;

  const modifierPreview = pendingMetadata.colorModifier
    ? resolveColorModifierPreview(
        [
          ...tokens.filter((row) => row.id !== token.id),
          buildModifierPreviewToken(
            token,
            modifierPreviewEdit.valueKind,
            modifierPreviewEdit.rawValue,
            pendingMetadata.colorModifier,
          ),
        ],
        buildModifierPreviewToken(
          token,
          modifierPreviewEdit.valueKind,
          modifierPreviewEdit.rawValue,
          pendingMetadata.colorModifier,
        ),
        modifierPreviewMode,
      )
    : undefined;
  const modifierChanged =
    serializeColorModifier(pendingMetadata.colorModifier) !==
    serializeColorModifier(savedMetadata.colorModifier);

  function applyChanges() {
    if (!hasPendingChanges || !token) {
      return;
    }

    const metadata = {
      description: pendingMetadata.description,
      extensions: pendingMetadata.extensions,
      colorModifier: pendingMetadata.colorModifier,
    };
    // A draft-only token has no source entry yet: edits must remain a create
    // operation so the grouped save inserts it instead of trying to update it.
    const operation = tokenDrafts.some((entry) => entry.operation === "create")
      ? "create"
      : "update";

    if (panelEditScope === "all") {
      let appliedAnyValue = false;

      for (const mode of availableModes) {
        const saved = savedEditsByMode[mode];
        const pending =
          pendingEditsByMode[mode] ??
          getPendingTokenEdit(token, resolveStorageMode(token, mode));

        if (
          pending.valueKind !== saved.valueKind ||
          pending.rawValue !== saved.rawValue
        ) {
          appliedAnyValue = true;
          setDraft(
            buildDraftFromRow(
              token,
              resolveStorageMode(token, mode),
              pending.valueKind,
              pending.rawValue,
              operation,
              metadata,
            ),
          );
        }
      }

      if (hasPendingMetadataChanges && !appliedAnyValue) {
        const fallbackMode = availableModes[0];

        if (fallbackMode) {
          const pending =
            pendingEditsByMode[fallbackMode] ??
            getPendingTokenEdit(token, resolveStorageMode(token, fallbackMode));

          setDraft(
            buildDraftFromRow(
              token,
              resolveStorageMode(token, fallbackMode),
              pending.valueKind,
              pending.rawValue,
              operation,
              metadata,
            ),
          );
        }
      }

      return;
    }

    const nextDraft = buildDraftFromRow(
      token,
      activeMode,
      pendingEdit.valueKind,
      pendingEdit.rawValue,
      operation,
      metadata,
    );
    setDraft(nextDraft);
    setPendingEdit(getPendingTokenEdit(token, activeMode, nextDraft));
    setPendingMetadata(metadata);
  }

  function discardChanges() {
    if (!token) {
      return;
    }

    if (selectedTokenId && tokenDrafts.length > 0) {
      clearDraft(selectedTokenId);
    }

    if (panelEditScope === "all") {
      setPendingEditsByMode(buildPendingEditsByMode(token, availableModes, []));
      setPendingMetadata(getEditableTokenMetadata(token, undefined));
      return;
    }

    setPendingEdit(getPendingTokenEdit(token, activeMode, undefined));
    setPendingMetadata(getEditableTokenMetadata(token, undefined));
  }

  function deleteToken() {
    if (!token) {
      return;
    }

    const deleteSource =
      panelEditScope === "single" && savedEdit
        ? savedEdit
        : (savedEditsByMode[availableModes[0] ?? ""] ??
          getPendingTokenEdit(token, null));

    if (tokenDrafts.some((entry) => entry.operation === "create")) {
      clearDraft(token.id);
      closePanel();
      return;
    }

    setDraft({
      tokenId: token.id,
      fileId: token.fileId,
      path: token.name,
      ...(token.type ? { type: token.type } : {}),
      mode: activeMode,
      valueKind: deleteSource.valueKind,
      rawValue: deleteSource.rawValue,
      description: pendingMetadata.description,
      ...(pendingMetadata.extensions
        ? { extensions: pendingMetadata.extensions }
        : {}),
      ...(pendingMetadata.colorModifier
        ? { colorModifier: pendingMetadata.colorModifier }
        : {}),
      operation: "delete",
    });
    closePanel();
  }

  function addColorModifier() {
    if (!token || pendingMetadata.colorModifier) {
      return;
    }

    setPendingMetadata((current) => ({
      ...current,
      colorModifier: createDefaultColorModifier(),
    }));
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col border-l bg-background shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Token
          </p>
          <h2 className="whitespace-normal wrap-break-word font-mono text-sm font-medium">
            {token.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {token.type ? <Badge variant="outline">{token.type}</Badge> : null}
            {panelEditScope === "single" && panelFocusMode ? (
              <Badge variant="secondary" className="capitalize">
                {panelFocusMode}
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
            {panelEditScope === "all" ? (
              <div className="space-y-4">
                {availableModes.map((mode) => {
                  const pending =
                    pendingEditsByMode[mode] ??
                    getPendingTokenEdit(token, resolveStorageMode(token, mode));

                  return (
                    <div key={mode} className="space-y-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`token-value-input-${mode}`}
                      >
                        {pending.valueKind === "alias"
                          ? "Alias path"
                          : token.type && isCompositeTokenType(token.type)
                            ? "Value fields"
                            : "Value"}
                        <span className="ml-1.5 font-normal capitalize text-muted-foreground">
                          ({mode})
                        </span>
                      </label>
                      <TokenValueEditor
                        id={`token-value-input-${mode}`}
                        type={token.type}
                        valueKind={pending.valueKind}
                        rawValue={pending.rawValue}
                        raw={token.raw}
                        aliasOptions={aliasOptions}
                        onValueKindChange={(valueKind) =>
                          setPendingEditsByMode((current) => ({
                            ...current,
                            [mode]: { ...pending, valueKind },
                          }))
                        }
                        onRawValueChange={(rawValue) =>
                          setPendingEditsByMode((current) => ({
                            ...current,
                            [mode]: { ...pending, rawValue },
                          }))
                        }
                        hasColorModifier={Boolean(pendingMetadata.colorModifier)}
                        onColorModifierClick={addColorModifier}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
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
                  {panelFocusMode ? (
                    <span className="ml-1.5 font-normal capitalize text-muted-foreground">
                      ({panelFocusMode})
                    </span>
                  ) : null}
                </label>
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
                  hasColorModifier={Boolean(pendingMetadata.colorModifier)}
                  onColorModifierClick={addColorModifier}
                />
              </div>
            )}

            {token.type === "color" ? (
              <TokenColorModifierEditor
                value={pendingMetadata.colorModifier}
                colorAliases={colorAliasOptions}
                rows={tokens}
                previewToken={buildModifierPreviewToken(
                  token,
                  modifierPreviewEdit.valueKind,
                  modifierPreviewEdit.rawValue,
                  pendingMetadata.colorModifier,
                )}
                mode={modifierPreviewMode}
                onChange={(colorModifier) => {
                  setPendingMetadata((current) => ({ ...current, colorModifier }));
                }}
              />
            ) : null}

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
                value={pendingMetadata.description}
                onChange={(event) =>
                  setPendingMetadata((current) => ({
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
                key={`edit:${selectedTokenId ?? "none"}`}
                value={pendingMetadata.extensions}
                onChange={(extensions) =>
                  setPendingMetadata((current) => ({ ...current, extensions }))
                }
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This token is marked for deletion. Apply to save, then it will be
            removed from the source file.
          </p>
        )}

        <TokenDependencies
          token={token}
          tokens={tokens}
          drafts={drafts}
          mode={activeMode}
          onOpenToken={openDependency}
        />

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
            disabled={!hasPendingChanges || Boolean(modifierChanged && modifierPreview?.error)}
          >
            Apply
          </Button>
        ) : null}
        {hasPendingChanges || tokenDrafts.length > 0 ? (
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
                if (panelEditScope === "all") {
                  setPendingEditsByMode(
                    buildPendingEditsByMode(token, availableModes, []),
                  );
                  setPendingMetadata(
                    getEditableTokenMetadata(token, undefined),
                  );
                } else {
                  setPendingEdit(
                    getPendingTokenEdit(token, activeMode, undefined),
                  );
                  setPendingMetadata(
                    getEditableTokenMetadata(token, undefined),
                  );
                }
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
            className="text-destructive hover:text-destructive ml-auto"
            onClick={deleteToken}
          >
            <Trash2 className="text-destructive" size={14} />
            Delete token
          </Button>
        )}
      </div>
    </aside>
  );
}
