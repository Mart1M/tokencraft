import { createHash } from "node:crypto";
import path from "node:path";

import type { ModeStorage } from "@tokencraft/core";

import {
  buildStoredTokenEntry,
  resolveStoredTokenModes,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import type { StoredTokenEntry, TokenFileMetadata } from "@/lib/tokens/flatten";
import { entryToRawValue } from "@/lib/tokens/serialize";
import type { StoredTokenRawValue } from "@/lib/tokens/raw-value";
import type { TokenFormat } from "@tokencraft/core";

type ModeSourceFile = {
  path: string;
  format: TokenFormat;
  metadata: TokenFileMetadata;
};

export type ModeFileBinding = {
  mode: string;
  path: string;
};

/**
 * Pair collection files with mode names by index.
 * Extra files beyond the modes list are ignored for mode binding.
 */
export function bindModesToFiles(
  modes: string[] | undefined,
  files: string[]
): ModeFileBinding[] {
  if (!modes?.length || files.length === 0) {
    return [];
  }

  const count = Math.min(modes.length, files.length);
  const bindings: ModeFileBinding[] = [];

  for (let index = 0; index < count; index += 1) {
    bindings.push({ mode: modes[index], path: files[index] });
  }

  return bindings;
}

export function collectionIdFromPaths(paths: string[]) {
  return createHash("sha1").update(paths.slice().sort().join("\0")).digest("hex").slice(0, 16);
}

function displayToRaw(display: TokenDisplayValue): StoredTokenRawValue {
  if (display.kind === "alias") {
    return `{${display.aliasPath ?? display.text.replace(/^\{|\}$/g, "")}}`;
  }

  return display.text;
}

function scalarRawFromEntry(entry: StoredTokenEntry): StoredTokenRawValue {
  const raw = entryToRawValue(entry);

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, StoredTokenRawValue>;
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

function mergeTokenEntriesAcrossModes(
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

export function mergeSeparateModeFiles(input: {
  collectionName: string;
  modeFiles: Array<{ mode: string; file: ModeSourceFile }>;
  modeStorage: ModeStorage;
}) {
  const { collectionName, modeFiles, modeStorage } = input;
  const paths = modeFiles.map((entry) => entry.file.path);
  const modes = modeFiles.map((entry) => entry.mode);
  const format = modeFiles[0]?.file.format ?? "custom";
  const tokens = mergeTokenEntriesAcrossModes(
    modeFiles.map(({ mode, file }) => ({ mode, tokens: file.metadata.tokens }))
  );
  const topLevelKeys = [
    ...new Set(modeFiles.flatMap((entry) => entry.file.metadata.topLevelKeys)),
  ].sort();

  return {
    id: collectionIdFromPaths(paths),
    path: paths[0] ?? collectionName,
    collectionName,
    configuredModes: modes,
    modeStorage,
    modeFiles: Object.fromEntries(modeFiles.map(({ mode, file }) => [mode, file.path])),
    format,
    tokenCount: tokens.length,
    metadata: { topLevelKeys, tokens },
  };
}

/**
 * Split a merged collection metadata back into per-mode file payloads.
 * Each mode file receives scalar values for tokens that have that mode.
 */
export function splitMetadataForModeFiles(
  metadata: TokenFileMetadata,
  modeFiles: Record<string, string>
): Array<{ path: string; mode: string; metadata: TokenFileMetadata }> {
  return Object.entries(modeFiles).map(([mode, filePath]) => {
    const tokens: StoredTokenEntry[] = [];
    const topLevelKeys = new Set<string>();

    for (const entry of metadata.tokens) {
      const modes = resolveStoredTokenModes(entry);
      const modeDisplay = modes?.[mode];

      if (!modeDisplay) {
        continue;
      }

      const raw =
        entry.raw &&
        typeof entry.raw === "object" &&
        !Array.isArray(entry.raw) &&
        mode in (entry.raw as Record<string, unknown>)
          ? (entry.raw as Record<string, StoredTokenRawValue>)[mode]
          : displayToRaw(modeDisplay);

      const next: StoredTokenEntry = buildStoredTokenEntry(entry.path, entry.type, raw);

      if (entry.description) {
        next.description = entry.description;
      }
      if (entry.extensions) {
        next.extensions = entry.extensions;
      }
      if (entry.colorModifier) {
        next.colorModifier = entry.colorModifier;
      }

      tokens.push(next);

      const topLevelKey = entry.path.split(".")[0];
      if (topLevelKey) {
        topLevelKeys.add(topLevelKey);
      }
    }

    return {
      path: filePath,
      mode,
      metadata: {
        topLevelKeys: [...topLevelKeys].sort(),
        tokens,
      },
    };
  });
}

export function suggestModeFilePath(
  existingModeFiles: Record<string, string>,
  mode: string
) {
  const existingPaths = Object.values(existingModeFiles);

  if (existingPaths.length === 0) {
    return `${mode.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "mode"}.tokens.json`;
  }

  const sample = existingPaths[0];
  const directory = path.posix.dirname(sample);
  const extension = sample.endsWith(".tokens.json")
    ? ".tokens.json"
    : path.posix.extname(sample) || ".json";
  const slug = mode.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "mode";
  const candidate =
    directory && directory !== "."
      ? `${directory}/${slug}${extension}`
      : `${slug}${extension}`;

  if (!existingPaths.includes(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (
    existingPaths.includes(
      directory && directory !== "."
        ? `${directory}/${slug}-${suffix}${extension}`
        : `${slug}-${suffix}${extension}`
    )
  ) {
    suffix += 1;
  }

  return directory && directory !== "."
    ? `${directory}/${slug}-${suffix}${extension}`
    : `${slug}-${suffix}${extension}`;
}

export function renameModeFilePath(filePath: string, oldMode: string, newMode: string) {
  const directory = path.posix.dirname(filePath);
  const base = path.posix.basename(filePath);
  const oldSlug = oldMode.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const newSlug = newMode.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "mode";

  if (!oldSlug || !base.toLowerCase().includes(oldSlug)) {
    return filePath;
  }

  const nextBase = base.replace(new RegExp(oldSlug, "i"), newSlug);
  return directory && directory !== "." ? `${directory}/${nextBase}` : nextBase;
}
