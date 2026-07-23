import {
  buildTokenDisplayValueFromString,
  resolveStoredTokenModes,
} from "@/lib/tokens/display";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { flattenTokenEntries } from "@/lib/tokens/flatten";
import { mergeTokenEntriesAcrossModes } from "@/lib/tokens/mode-merge";

export type JsonDocumentInput = {
  mode: string | null;
  path: string;
  content: string;
};

export type JsonPreviewResult =
  | { ok: true; tokens: ImportedTokenRow[] }
  | { ok: false; error: string };

function entriesToRows(
  entries: ReturnType<typeof flattenTokenEntries>,
  meta: { fileId: string; collectionName: string; sourcePath: string },
): ImportedTokenRow[] {
  return entries
    .map((entry) => {
      const modes = resolveStoredTokenModes(entry);
      const row: ImportedTokenRow = {
        id: `${meta.fileId}:${entry.path}`,
        fileId: meta.fileId,
        sourcePath: meta.sourcePath,
        collectionName: meta.collectionName,
        name: entry.path,
        value: entry.value,
        ...(entry.type ? { type: entry.type } : {}),
        ...(entry.raw !== undefined ? { raw: entry.raw } : {}),
        ...(entry.display ? { display: entry.display } : {}),
        ...(entry.description ? { description: entry.description } : {}),
        ...(entry.extensions ? { extensions: entry.extensions } : {}),
        ...(entry.colorModifier ? { colorModifier: entry.colorModifier } : {}),
        ...(modes ? { modes } : {}),
      };

      if (!row.display && !row.modes) {
        row.display = buildTokenDisplayValueFromString(entry.value, entry.type);
      }

      return row;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function parseDocument(content: string, label: string) {
  try {
    return { ok: true as const, value: JSON.parse(content) as unknown };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? `Invalid JSON (${label}): ${error.message}`
          : `Invalid JSON (${label}).`,
    };
  }
}

/**
 * Rebuild collection token rows from edited JSON document(s).
 * Separate-files collections pass one document per mode; value-map passes a single document.
 */
export function buildTokensFromJsonDocuments(input: {
  fileId: string;
  collectionName: string;
  sourcePath: string;
  documents: JsonDocumentInput[];
}): JsonPreviewResult {
  const { fileId, collectionName, sourcePath, documents } = input;
  const usable = documents.filter((document) => document.content.trim().length > 0);

  if (usable.length === 0) {
    return { ok: true, tokens: [] };
  }

  const multiMode = usable.some((document) => document.mode !== null) && usable.length > 1;

  if (multiMode) {
    const modeEntries: Array<{
      mode: string;
      tokens: ReturnType<typeof flattenTokenEntries>;
    }> = [];

    for (const document of usable) {
      const mode = document.mode ?? "Default";
      const parsed = parseDocument(document.content, mode);
      if (!parsed.ok) {
        return parsed;
      }

      modeEntries.push({
        mode,
        tokens: flattenTokenEntries(parsed.value),
      });
    }

    const merged = mergeTokenEntriesAcrossModes(modeEntries);
    return {
      ok: true,
      tokens: entriesToRows(merged, { fileId, collectionName, sourcePath }),
    };
  }

  const document = usable[0];
  const label = document.mode ?? (document.path || "document");
  const parsed = parseDocument(document.content, label);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    tokens: entriesToRows(flattenTokenEntries(parsed.value), {
      fileId,
      collectionName,
      sourcePath,
    }),
  };
}

export function applyJsonTokenOverrides(
  tokens: ImportedTokenRow[],
  overrides: Record<string, ImportedTokenRow[]>,
): ImportedTokenRow[] {
  const fileIds = Object.keys(overrides);
  if (fileIds.length === 0) {
    return tokens;
  }

  const overridden = new Set(fileIds);
  return [
    ...tokens.filter((token) => !overridden.has(token.fileId)),
    ...fileIds.flatMap((fileId) => overrides[fileId] ?? []),
  ].sort((left, right) => left.name.localeCompare(right.name));
}
