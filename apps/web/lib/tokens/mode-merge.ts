import {
  buildStoredTokenEntry,
  resolveStoredTokenModes,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import type { StoredTokenEntry } from "@/lib/tokens/flatten";
import { entryToRawValue } from "@/lib/tokens/serialize";
import type { StoredTokenRawValue } from "@/lib/tokens/raw-value";

function displayToRaw(display: TokenDisplayValue): StoredTokenRawValue {
  if (display.kind === "alias") {
    return `{${display.aliasPath ?? display.text.replace(/^\{|\}$/g, "")}}`;
  }

  return display.text;
}

function scalarRawFromEntry(entry: StoredTokenEntry): StoredTokenRawValue {
  const raw = entryToRawValue(entry);

  // Multi-layer shadows (and similar) must stay arrays — do not fall through to
  // display.text, which is only a CSS-like preview string.
  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, StoredTokenRawValue>;

    // Single composite token object (shadow / border / typography / …).
    if (
      "blur" in record ||
      "offsetX" in record ||
      "offsetY" in record ||
      "x" in record ||
      "y" in record ||
      "color" in record ||
      "width" in record ||
      "fontSize" in record ||
      "fontFamily" in record ||
      "fontWeight" in record ||
      "url" in record ||
      "dashArray" in record ||
      "duration" in record
    ) {
      return record;
    }

    const firstKey = Object.keys(record)[0];
    if (firstKey !== undefined) {
      return record[firstKey];
    }
  }

  if (raw !== undefined && (typeof raw !== "object" || raw === null)) {
    return raw as StoredTokenRawValue;
  }

  const modes = resolveStoredTokenModes(entry);
  if (modes) {
    const firstMode = Object.keys(modes)[0];
    if (firstMode) {
      return displayToRaw(modes[firstMode]);
    }
  }

  if (entry.display) {
    return displayToRaw(entry.display);
  }

  return entry.value;
}

export function mergeTokenEntriesAcrossModes(
  modeEntries: Array<{ mode: string; tokens: StoredTokenEntry[] }>
): StoredTokenEntry[] {
  const byPath = new Map<
    string,
    {
      type?: string;
      description?: string;
      extensions?: Record<string, string>;
      colorModifier?: StoredTokenEntry["colorModifier"];
      raw: Record<string, StoredTokenRawValue>;
    }
  >();

  for (const { mode, tokens } of modeEntries) {
    for (const entry of tokens) {
      const existing = byPath.get(entry.path) ?? {
        ...(entry.type ? { type: entry.type } : {}),
        ...(entry.description ? { description: entry.description } : {}),
        ...(entry.extensions ? { extensions: { ...entry.extensions } } : {}),
        ...(entry.colorModifier ? { colorModifier: entry.colorModifier } : {}),
        raw: {},
      };

      if (!existing.type && entry.type) {
        existing.type = entry.type;
      }
      if (!existing.description && entry.description) {
        existing.description = entry.description;
      }
      if (!existing.extensions && entry.extensions) {
        existing.extensions = { ...entry.extensions };
      }
      if (!existing.colorModifier && entry.colorModifier) {
        existing.colorModifier = entry.colorModifier;
      }

      existing.raw[mode] = scalarRawFromEntry(entry);
      byPath.set(entry.path, existing);
    }
  }

  return [...byPath.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tokenPath, merged]) => {
      const entry: StoredTokenEntry = buildStoredTokenEntry(
        tokenPath,
        merged.type,
        merged.raw
      );

      if (merged.description) {
        entry.description = merged.description;
      }
      if (merged.extensions) {
        entry.extensions = merged.extensions;
      }
      if (merged.colorModifier) {
        entry.colorModifier = merged.colorModifier;
      }

      return entry;
    });
}
