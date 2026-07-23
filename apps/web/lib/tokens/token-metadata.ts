import type { KeyValueItemData } from "@/components/ui/key-value";
import type { StoredTokenEntry } from "@/lib/tokens/flatten";
import {
  parseTokenColorModifier,
  type TokenColorModifier,
} from "@/lib/tokens/color-modifier";

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
    typeof record.$description === "string"
      ? record.$description
      : typeof record.description === "string"
        ? record.description
        : undefined;
  const rawExtensions =
    record.$extensions !== undefined ? record.$extensions : record.extensions;
  let modifier: ReturnType<typeof parseTokenColorModifier>;
  if (rawExtensions && typeof rawExtensions === "object" && !Array.isArray(rawExtensions)) {
    const ext = rawExtensions as Record<string, unknown>;
    // Native Tokencraft format takes priority
    if (ext.tokencraft && typeof ext.tokencraft === "object" && !Array.isArray(ext.tokencraft)) {
      modifier = parseTokenColorModifier((ext.tokencraft as Record<string, unknown>).modify);
    }
    // Fall back to studio.tokens vendor extension
    if (!modifier) {
      const studioTokens = ext["studio.tokens"];
      if (studioTokens && typeof studioTokens === "object" && !Array.isArray(studioTokens)) {
        const parsed = parseTokenColorModifier((studioTokens as Record<string, unknown>).modify);
        if (parsed) {
          modifier = { ...parsed, format: "studio.tokens" };
        }
      }
    }
  }
  const extensions = parseDtcgExtensions(withoutKnownModifiers(rawExtensions));

  return {
    ...(description ? { description } : {}),
    ...(extensions ? { extensions } : {}),
    ...(modifier ? { colorModifier: modifier } : {}),
  };
}

function withoutKnownModifiers(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const extensions = { ...(value as Record<string, unknown>) };

  // Strip tokencraft.modify (native format)
  const tokencraft = extensions.tokencraft;
  if (tokencraft && typeof tokencraft === "object" && !Array.isArray(tokencraft)) {
    const remaining = { ...(tokencraft as Record<string, unknown>) };
    delete remaining.modify;
    if (Object.keys(remaining).length > 0) {
      extensions.tokencraft = remaining;
    } else {
      delete extensions.tokencraft;
    }
  }

  // Strip studio.tokens.modify (Tokens Studio vendor extension)
  const studioTokens = extensions["studio.tokens"];
  if (studioTokens && typeof studioTokens === "object" && !Array.isArray(studioTokens)) {
    const remaining = { ...(studioTokens as Record<string, unknown>) };
    delete remaining.modify;
    if (Object.keys(remaining).length > 0) {
      extensions["studio.tokens"] = remaining;
    } else {
      delete extensions["studio.tokens"];
    }
  }

  return extensions;
}

export function mergeTokenMetadata(
  entry: StoredTokenEntry,
  draft: {
    description?: string;
    extensions?: TokenExtensions;
    colorModifier?: TokenColorModifier | null;
  },
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
  const colorModifier =
    Object.hasOwn(draft, "colorModifier")
      ? draft.colorModifier
      : previous?.colorModifier ?? entry.colorModifier;

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

  if (colorModifier) {
    next.colorModifier = colorModifier;
  } else {
    delete next.colorModifier;
  }

  return next;
}
