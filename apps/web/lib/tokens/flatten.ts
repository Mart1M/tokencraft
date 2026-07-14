import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import {
  buildStoredTokenEntry,
  isTokenDisplayValue,
  resolveStoredTokenModes,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import { toStoredTokenRawValue } from "@/lib/tokens/raw-value";
import { extractDtcgTokenMetadata } from "@/lib/tokens/token-metadata";

export type StoredTokenRawValue =
  import("@/lib/tokens/raw-value").StoredTokenRawValue;

export type StoredTokenEntry = {
  path: string;
  type?: string;
  value: string;
  raw?: StoredTokenRawValue;
  display?: TokenDisplayValue;
  modes?: Record<string, TokenDisplayValue>;
  description?: string;
  extensions?: Record<string, string>;
};

export type TokenFileMetadata = {
  topLevelKeys: string[];
  tokens: StoredTokenEntry[];
};

function extractTokenValue(record: Record<string, unknown>) {
  if ("$value" in record) {
    return record.$value;
  }

  if ("value" in record) {
    return record.value;
  }

  return undefined;
}

function extractTokenType(record: Record<string, unknown>) {
  if (typeof record.$type === "string") {
    return record.$type;
  }

  if (typeof record.type === "string") {
    return record.type;
  }

  return undefined;
}

function isTokenDisplayValueLocal(value: unknown): value is TokenDisplayValue {
  return isTokenDisplayValue(value);
}

function parseStoredTokenEntry(entry: unknown): StoredTokenEntry | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;

  if (typeof record.path !== "string" || typeof record.value !== "string") {
    return null;
  }

  const parsed: StoredTokenEntry = {
    path: record.path,
    value: record.value,
    ...(toStoredTokenRawValue(record.raw) !== undefined
      ? { raw: toStoredTokenRawValue(record.raw) }
      : {}),
    ...(typeof record.type === "string" ? { type: record.type } : {}),
    ...(typeof record.description === "string" ? { description: record.description } : {}),
    ...(record.extensions &&
    typeof record.extensions === "object" &&
    !Array.isArray(record.extensions)
      ? { extensions: record.extensions as Record<string, string> }
      : {}),
    ...(isTokenDisplayValueLocal(record.display) ? { display: record.display } : {}),
  };

  if (record.modes && typeof record.modes === "object" && !Array.isArray(record.modes)) {
    const modes: Record<string, TokenDisplayValue> = {};

    for (const [mode, modeValue] of Object.entries(record.modes)) {
      if (isTokenDisplayValueLocal(modeValue)) {
        modes[mode] = modeValue;
      }
    }

    if (Object.keys(modes).length > 0) {
      parsed.modes = modes;
    }
  }

  const resolvedModes = resolveStoredTokenModes(parsed);
  if (resolvedModes) {
    parsed.modes = resolvedModes;
  }

  return parsed;
}

export function flattenTokenEntries(value: unknown, prefix: string[] = []): StoredTokenEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const tokenValue = extractTokenValue(record);

  if (tokenValue !== undefined) {
    const type = extractTokenType(record);

    return [
      {
        ...buildStoredTokenEntry(prefix.join("."), type, tokenValue),
        ...extractDtcgTokenMetadata(record),
      },
    ];
  }

  const entries: StoredTokenEntry[] = [];

  for (const [key, child] of Object.entries(record)) {
    if (key.startsWith("$")) {
      continue;
    }

    entries.push(...flattenTokenEntries(child, [...prefix, key]));
  }

  return entries;
}

export function parseTokenFileMetadata(metadata: unknown): TokenFileMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { topLevelKeys: [], tokens: [] };
  }

  const record = metadata as Record<string, unknown>;
  const topLevelKeys = Array.isArray(record.topLevelKeys)
    ? record.topLevelKeys.filter((key): key is string => typeof key === "string")
    : [];
  const tokens = Array.isArray(record.tokens)
    ? record.tokens
        .map(parseStoredTokenEntry)
        .filter((entry): entry is StoredTokenEntry => entry !== null)
    : [];

  return { topLevelKeys, tokens };
}

export { formatDtcgTokenValue };
