import type { ImportedTokenRow } from "@/lib/tokens/entries";
import {
  buildTokenDisplayValue,
  buildTokenDisplayValueFromString,
  resolveModeKey,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import {
  normalizeAliasInput,
  stripAliasBraces,
} from "@/lib/tokens/json-patch";
import { isCompositeTokenType } from "@/lib/tokens/composite-fields";
import type { StoredTokenRawValue } from "@/lib/tokens/raw-value";
import {
  type TokenExtensions,
} from "@/lib/tokens/token-metadata";
import type { TokenColorModifier } from "@/lib/tokens/color-modifier";
import {
  objectToCompositeFieldValues,
  resolveStoredRawArray,
  resolveStoredRawObject,
  serializeCompositeFieldValues,
  tryParseJsonValue,
} from "@/lib/tokens/value-editor";

export type TokenValueKind = "alias" | "literal";

export type TokenDraftOperation = "create" | "update" | "delete";

export type TokenDraft = {
  tokenId: string;
  fileId: string;
  path: string;
  type?: string;
  mode: string | null;
  valueKind: TokenValueKind;
  rawValue: string;
  operation?: TokenDraftOperation;
  description?: string;
  extensions?: TokenExtensions;
  colorModifier?: TokenColorModifier | null;
};

export function getDraftKey(draft: Pick<TokenDraft, "tokenId" | "mode">) {
  if (draft.mode) {
    return `${draft.tokenId}::${draft.mode}`;
  }

  return draft.tokenId;
}

export function getDraftsForToken(
  drafts: Record<string, TokenDraft>,
  tokenId: string,
): TokenDraft[] {
  return Object.entries(drafts)
    .filter(([key]) => key === tokenId || key.startsWith(`${tokenId}::`))
    .map(([, draft]) => draft);
}

export function resolveStorageMode(
  token: ImportedTokenRow,
  mode: string,
): string | null {
  if (token.modes) {
    return (
      resolveModeKey(token.modes, mode) ??
      (mode === "Default" ? null : mode)
    );
  }

  return mode === "Default" ? null : mode;
}

export function formatDraftValue(
  draft: Pick<TokenDraft, "valueKind" | "rawValue" | "type">
) {
  if (draft.valueKind === "alias") {
    return normalizeAliasInput(draft.rawValue);
  }

  const trimmed = draft.rawValue.trim();

  if (draft.type && isCompositeTokenType(draft.type)) {
    const parsed = tryParseJsonValue(trimmed);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  }

  const parsedJson = tryParseJsonValue(trimmed);

  if (parsedJson !== null) {
    return parsedJson;
  }

  return trimmed;
}

export function inferValueKind(value: string, type?: string): TokenValueKind {
  if (/^\{[^}]+\}$/.test(value.trim())) {
    return "alias";
  }

  if (type === "color" || type === "dimension" || type === "duration") {
    return "literal";
  }

  return "literal";
}

export function draftFromDisplayValue(
  token: ImportedTokenRow,
  mode: string | null,
  display: TokenDisplayValue
): Pick<TokenDraft, "valueKind" | "rawValue"> {
  if (display.kind === "alias") {
    return {
      valueKind: "alias",
      rawValue: display.aliasPath ?? stripAliasBraces(display.text),
    };
  }

  if (display.kind === "color") {
    return {
      valueKind: "literal",
      rawValue: display.text,
    };
  }

  if (token.type === "composition") {
    const rawObject = resolveStoredRawObject(token.raw);

    if (rawObject) {
      return {
        valueKind: "literal",
        rawValue: JSON.stringify(rawObject, null, 2),
      };
    }
  }

  if (token.type && isCompositeTokenType(token.type)) {
    const rawObject = resolveCompositeRawObject(token, mode);

    if (rawObject) {
      return {
        valueKind: "literal",
        rawValue: serializeCompositeFieldValues(
          token.type,
          objectToCompositeFieldValues(token.type, rawObject)
        ),
      };
    }

    const rawArray = resolveCompositeRawArray(token, mode);

    if (rawArray) {
      return {
        valueKind: "literal",
        rawValue: JSON.stringify(rawArray),
      };
    }
  }

  return {
    valueKind: inferValueKind(display.text, token.type),
    rawValue: display.text,
  };
}

function resolveCompositeRawObject(
  token: ImportedTokenRow,
  mode: string | null
): Record<string, unknown> | null {
  if (mode && token.modes) {
    const modeKey = mode ? resolveModeKey(token.modes, mode) : null;

    if (modeKey) {
      // Mode values are display-only here; fall back to top-level raw below.
    }
  }

  return resolveStoredRawObject(token.raw);
}

function resolveCompositeRawArray(
  token: ImportedTokenRow,
  _mode: string | null
) {
  return resolveStoredRawArray(token.raw);
}

export function applyDraftToRow(
  row: ImportedTokenRow,
  draft: TokenDraft
): ImportedTokenRow {
  const formatted = formatDraftValue(draft);

  if (draft.mode) {
    // Seed a modes map from the token's current flat value when it doesn't
    // have one yet, so setting a value under a brand-new mode doesn't lose
    // the existing value or silently edit the wrong field.
    const existingModes =
      row.modes ??
      ({
        Default: row.display ?? buildTokenDisplayValueFromString(row.value, row.type),
      } satisfies Record<string, TokenDisplayValue>);

    const nextModes = {
      ...existingModes,
      [draft.mode]: buildTokenDisplayValue(formatted, row.type),
    };

    const rawModes = Object.fromEntries(
      Object.entries(nextModes).map(([mode, display]) => [
        mode,
        display.kind === "alias"
          ? normalizeAliasInput(display.aliasPath ?? display.text)
          : display.text,
      ])
    );

    return {
      ...row,
      ...(draft.description !== undefined ? { description: draft.description } : {}),
      ...(draft.extensions !== undefined ? { extensions: draft.extensions } : {}),
      ...(Object.hasOwn(draft, "colorModifier")
        ? { colorModifier: draft.colorModifier ?? undefined }
        : {}),
      modes: nextModes,
      value: formatDtcgTokenValue(rawModes, row.type),
    };
  }

  const display = buildTokenDisplayValue(formatted, row.type);

  return {
    ...row,
    ...(draft.description !== undefined ? { description: draft.description } : {}),
    ...(draft.extensions !== undefined ? { extensions: draft.extensions } : {}),
    ...(Object.hasOwn(draft, "colorModifier")
      ? { colorModifier: draft.colorModifier ?? undefined }
      : {}),
    display,
    modes: undefined,
    value: formatDtcgTokenValue(formatted, row.type),
    ...(typeof formatted === "object" && formatted !== null
      ? { raw: formatted as StoredTokenRawValue }
      : {}),
  };
}

export function getEffectiveTokenRow(
  row: ImportedTokenRow,
  draft?: TokenDraft | TokenDraft[],
): ImportedTokenRow {
  if (!draft) {
    return row;
  }

  const drafts = Array.isArray(draft) ? draft : [draft];

  return drafts.reduce(
    (current, nextDraft) => applyDraftToRow(current, nextDraft),
    row,
  );
}

export function getEditableRawValue(
  row: ImportedTokenRow,
  mode: string | null,
  draft?: TokenDraft
) {
  if (draft) {
    return {
      valueKind: draft.valueKind,
      rawValue: draft.rawValue,
    };
  }

  if (mode) {
    const modeKey = row.modes ? resolveModeKey(row.modes, mode) : null;

    if (modeKey && row.modes) {
      return draftFromDisplayValue(row, mode, row.modes[modeKey]);
    }

    if (row.modes) {
      // Brand-new mode on a token that already has other modes: start from
      // an empty value instead of dumping the raw multi-mode JSON.
      return { valueKind: "literal" as const, rawValue: "" };
    }

    // Token doesn't have a modes map yet; seed the new mode from its
    // current flat value so it's not created blank.
    if (row.display) {
      return draftFromDisplayValue(row, mode, row.display);
    }

    return {
      valueKind: inferValueKind(row.value, row.type),
      rawValue: row.value,
    };
  }

  if (row.display) {
    return draftFromDisplayValue(row, mode, row.display);
  }

  return {
    valueKind: inferValueKind(row.value, row.type),
    rawValue: row.value,
  };
}

export function getEditableTokenMetadata(
  row: ImportedTokenRow,
  draft?: TokenDraft
) {
  return {
    description: draft?.description ?? row.description ?? "",
    extensions: draft?.extensions ?? row.extensions,
    colorModifier: draft?.colorModifier === null
      ? undefined
      : draft?.colorModifier ?? row.colorModifier,
  };
}

export function buildDraftFromRow(
  row: ImportedTokenRow,
  mode: string | null,
  valueKind: TokenValueKind,
  rawValue: string,
  operation?: TokenDraftOperation,
  metadata?: Pick<TokenDraft, "description" | "extensions" | "colorModifier">
): TokenDraft {
  return {
    tokenId: row.id,
    fileId: row.fileId,
    path: row.name,
    ...(row.type ? { type: row.type } : {}),
    mode,
    valueKind,
    rawValue,
    ...(operation ? { operation } : {}),
    description: metadata?.description ?? row.description ?? "",
    ...(metadata?.extensions !== undefined
      ? metadata.extensions
        ? { extensions: metadata.extensions }
        : {}
      : row.extensions
        ? { extensions: row.extensions }
        : {}),
    ...(metadata && Object.hasOwn(metadata, "colorModifier")
      ? { colorModifier: metadata.colorModifier ?? null }
      : row.colorModifier
        ? { colorModifier: row.colorModifier }
        : {}),
  };
}

export function buildPendingTokenId(fileId: string, path: string) {
  return `pending:${fileId}:${path}`;
}

export function buildCreateDraft(input: {
  fileId: string;
  path: string;
  type?: string;
  mode: string | null;
  valueKind: TokenValueKind;
  rawValue: string;
  description?: string;
  extensions?: TokenExtensions;
  colorModifier?: TokenColorModifier;
}): TokenDraft {
  return {
    tokenId: buildPendingTokenId(input.fileId, input.path),
    fileId: input.fileId,
    path: input.path,
    ...(input.type ? { type: input.type } : {}),
    mode: input.mode,
    valueKind: input.valueKind,
    rawValue: input.rawValue,
    operation: "create",
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.extensions ? { extensions: input.extensions } : {}),
    ...(input.colorModifier ? { colorModifier: input.colorModifier } : {}),
  };
}

export function mergeDraftIntoDisplayValue(
  row: ImportedTokenRow,
  mode: string | null,
  draft?: TokenDraft
) {
  const effective = getEffectiveTokenRow(row, draft);

  if (effective.modes && mode) {
    const modeKey = resolveModeKey(effective.modes, mode);

    if (modeKey) {
      return effective.modes[modeKey];
    }
  }

  return (
    effective.display ?? buildTokenDisplayValueFromString(effective.value, row.type)
  );
}
