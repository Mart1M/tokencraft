import type { KeyValueItemData } from "@/components/ui/key-value";
import type { StoredTokenEntry } from "@/lib/tokens/flatten";

export type TokenExtensions = Record<string, string>;

export function parseDtcgExtensions(value: unknown): TokenExtensions | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const result: TokenExtensions = {};
  flattenExtensionObject(value as Record<string, unknown>, "", result);

  return Object.keys(result).length > 0 ? result : undefined;
}

function flattenExtensionObject(
  object: Record<string, unknown>,
  prefix: string,
  output: TokenExtensions
) {
  for (const [key, rawValue] of Object.entries(object)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      flattenExtensionObject(rawValue as Record<string, unknown>, fullKey, output);
      continue;
    }

    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    output[fullKey] = typeof rawValue === "string" ? rawValue : String(rawValue);
  }
}

export function extensionsToKeyValueItems(
  extensions?: TokenExtensions
): KeyValueItemData[] {
  if (!extensions) {
    return [];
  }

  return Object.entries(extensions).map(([key, value], index) => ({
    id: `ext:${index}`,
    key,
    value,
  }));
}

export function keyValueItemsToExtensions(
  items: KeyValueItemData[]
): TokenExtensions | undefined {
  const record: TokenExtensions = {};

  for (const item of items) {
    const key = item.key.trim();

    if (!key) {
      continue;
    }

    record[key] = item.value;
  }

  return Object.keys(record).length > 0 ? record : undefined;
}

export function extractDtcgTokenMetadata(record: Record<string, unknown>) {
  const description =
    typeof record.$description === "string" ? record.$description : undefined;
  const extensions = parseDtcgExtensions(record.$extensions);

  return {
    ...(description ? { description } : {}),
    ...(extensions ? { extensions } : {}),
  };
}

export function mergeTokenMetadata(
  entry: StoredTokenEntry,
  draft: { description?: string; extensions?: TokenExtensions },
  previous?: StoredTokenEntry
): StoredTokenEntry {
  const description =
    draft.description !== undefined
      ? draft.description.trim() || undefined
      : previous?.description ?? entry.description;

  const extensions =
    draft.extensions !== undefined
      ? draft.extensions
      : previous?.extensions ?? entry.extensions;

  const next: StoredTokenEntry = { ...entry };

  if (description) {
    next.description = description;
  } else {
    delete next.description;
  }

  if (extensions && Object.keys(extensions).length > 0) {
    next.extensions = extensions;
  } else {
    delete next.extensions;
  }

  return next;
}
