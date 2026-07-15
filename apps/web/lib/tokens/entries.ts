import {
  buildTokenDisplayValueFromString,
  collectTokenModes,
  resolveStoredTokenModes,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import type { LocalTokenFile } from "@/lib/tokens/fs";
import { type StoredTokenEntry, type StoredTokenRawValue } from "@/lib/tokens/flatten";

export type ImportedTokenRow = {
  id: string;
  fileId: string;
  sourcePath: string;
  collectionName: string;
  name: string;
  type?: string;
  value: string;
  raw?: StoredTokenRawValue;
  display?: TokenDisplayValue;
  modes?: Record<string, TokenDisplayValue>;
  description?: string;
  extensions?: Record<string, string>;
};

export type TokenAliasOption = {
  path: string;
  type?: string;
  collectionName: string;
  sourcePath: string;
};

export function getTokenAliasOptions(
  tokens: ImportedTokenRow[],
  excludeTokenId?: string
): TokenAliasOption[] {
  return tokens
    .filter((token) => token.id !== excludeTokenId)
    .map((token) => ({
      path: token.name,
      ...(token.type ? { type: token.type } : {}),
      collectionName: token.collectionName,
      sourcePath: token.sourcePath,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export type TokenSidebarCollection = {
  id: string;
  name: string;
  modes: string[];
  path: string;
  pendingDelete?: boolean;
};

function collectModesFromStoredTokens(tokens: StoredTokenEntry[]) {
  const modeRows = tokens.map((entry) => {
    const modes = resolveStoredTokenModes(entry);

    if (modes) {
      return { modes };
    }

    return {};
  });

  return collectTokenModes(modeRows);
}

export function getTokenSidebarCollections(
  tokenFiles: LocalTokenFile[],
  pendingCollectionDeletes: string[] = []
): TokenSidebarCollection[] {
  return tokenFiles.map((file) => {
    const modes = file.configuredModes?.length
      ? file.configuredModes
      : collectModesFromStoredTokens(file.metadata.tokens);

    return {
      id: file.id,
      name: file.collectionName,
      modes: modes.length > 0 ? modes : ["Default"],
      path: file.path,
      ...(pendingCollectionDeletes.includes(file.id) ? { pendingDelete: true } : {}),
    };
  });
}

export function getImportedTokenRows(tokenFiles: LocalTokenFile[]): ImportedTokenRow[] {
  const rows: ImportedTokenRow[] = [];

  for (const file of tokenFiles) {
    const metadata = file.metadata;

    for (const entry of metadata.tokens) {
      const modes = resolveStoredTokenModes(entry);
      const row: ImportedTokenRow = {
        id: `${file.id}:${entry.path}`,
        fileId: file.id,
        sourcePath: file.path,
        collectionName: file.collectionName,
        name: entry.path,
        value: entry.value,
        ...(entry.type ? { type: entry.type } : {}),
        ...(entry.raw !== undefined ? { raw: entry.raw } : {}),
        ...(entry.display ? { display: entry.display } : {}),
        ...(entry.description ? { description: entry.description } : {}),
        ...(entry.extensions ? { extensions: entry.extensions } : {}),
        ...(modes ? { modes } : {}),
      };

      if (!row.display && !row.modes) {
        row.display = buildTokenDisplayValueFromString(entry.value, entry.type);
      }

      rows.push(row);
    }
  }

  return rows.sort((left, right) => left.name.localeCompare(right.name));
}
