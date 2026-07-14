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
  mergeTokenMetadata,
  type TokenExtensions,
} from "@/lib/tokens/token-metadata";
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
};

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

  if (draft.mode && row.modes) {
    const nextModes = {
      ...row.modes,
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
      modes: nextModes,
      value: formatDtcgTokenValue(rawModes, row.type),
    };
  }

  const display = buildTokenDisplayValue(formatted, row.type);

  return {
    ...row,
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
  draft?: TokenDraft
): ImportedTokenRow {
  if (!draft) {
    return row;
  }

  return applyDraftToRow(row, draft);
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

  const modeKey = row.modes && mode ? resolveModeKey(row.modes, mode) : null;
  const display =
    modeKey && row.modes ? row.modes[modeKey] : row.display;

  if (display) {
    return draftFromDisplayValue(row, mode, display);
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
  };
}

export function buildDraftFromRow(
  row: ImportedTokenRow,
  mode: string | null,
  valueKind: TokenValueKind,
  rawValue: string,
  operation?: TokenDraftOperation,
  metadata?: Pick<TokenDraft, "description" | "extensions">
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
