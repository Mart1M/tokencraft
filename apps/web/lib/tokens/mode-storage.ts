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

export type DetectedModeGroup = {
  collectionName: string;
  modes: string[];
  paths: string[];
};

/** Minimum shared-token coverage (intersection / smaller file) to treat siblings as modes. */
export const SEPARATE_MODE_OVERLAP_THRESHOLD = 0.5;

const PREFERRED_MODE_ORDER = [
  "light",
  "dark",
  "default",
  "value",
  "compact",
  "hover",
  "active",
];

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

export function modeNameFromFilePath(filePath: string) {
  const base = path.posix.basename(filePath);
  return base.replace(/\.tokens\.json$/i, "").replace(/\.json$/i, "") || base;
}

export function collectionNameFromDirectory(directory: string) {
  const segments = directory
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/[-_]+/g, " ")
        .replace(/\btokens?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const deduped = segments.filter(
    (segment, index) =>
      index === 0 || segment.toLowerCase() !== segments[index - 1].toLowerCase()
  );

  return deduped.length > 0 ? deduped.join(" / ") : directory || "Collection";
}

function compareModeNames(left: string, right: string) {
  const leftIndex = PREFERRED_MODE_ORDER.indexOf(left.toLowerCase());
  const rightIndex = PREFERRED_MODE_ORDER.indexOf(right.toLowerCase());

  if (leftIndex !== -1 || rightIndex !== -1) {
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  }

  return left.localeCompare(right);
}

function tokenPathOverlapCoverage(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];

  for (const tokenPath of smaller) {
    if (larger.has(tokenPath)) {
      intersection += 1;
    }
  }

  return intersection / smaller.size;
}

/**
 * Detect sibling token files that share enough token paths to act as modes of
 * one collection (e.g. semantic/legacy/light.json + dark.json).
 */
export function detectSeparateModeGroups(
  files: Array<{ path: string; tokenPaths: string[] }>,
  options?: { threshold?: number }
): DetectedModeGroup[] {
  const threshold = options?.threshold ?? SEPARATE_MODE_OVERLAP_THRESHOLD;
  const byDirectory = new Map<string, Array<{ path: string; tokenPaths: Set<string> }>>();

  for (const file of files) {
    if (file.tokenPaths.length === 0) {
      continue;
    }

    const directory = path.posix.dirname(file.path);
    const bucket = byDirectory.get(directory) ?? [];
    bucket.push({ path: file.path, tokenPaths: new Set(file.tokenPaths) });
    byDirectory.set(directory, bucket);
  }

  const groups: DetectedModeGroup[] = [];

  for (const [directory, siblings] of byDirectory) {
    if (siblings.length < 2) {
      continue;
    }

    const parent = siblings.map((_, index) => index);

    function find(index: number): number {
      if (parent[index] !== index) {
        parent[index] = find(parent[index]);
      }
      return parent[index];
    }

    function union(left: number, right: number) {
      const rootLeft = find(left);
      const rootRight = find(right);
      if (rootLeft !== rootRight) {
        parent[rootRight] = rootLeft;
      }
    }

    for (let i = 0; i < siblings.length; i += 1) {
      for (let j = i + 1; j < siblings.length; j += 1) {
        const coverage = tokenPathOverlapCoverage(
          siblings[i].tokenPaths,
          siblings[j].tokenPaths
        );
        if (coverage >= threshold) {
          union(i, j);
        }
      }
    }

    const clusters = new Map<number, typeof siblings>();
    for (let index = 0; index < siblings.length; index += 1) {
      const root = find(index);
      const cluster = clusters.get(root) ?? [];
      cluster.push(siblings[index]);
      clusters.set(root, cluster);
    }

    for (const cluster of clusters.values()) {
      if (cluster.length < 2) {
        continue;
      }

      const ordered = [...cluster].sort((left, right) =>
        compareModeNames(modeNameFromFilePath(left.path), modeNameFromFilePath(right.path))
      );
      const modes = ordered.map((file) => modeNameFromFilePath(file.path));
      const paths = ordered.map((file) => file.path);

      // Avoid collapsing files whose basenames collide after stripping extensions.
      if (new Set(modes).size !== modes.length) {
        continue;
      }

      groups.push({
        collectionName: collectionNameFromDirectory(directory),
        modes,
        paths,
      });
    }
  }

  return groups.sort((left, right) =>
    left.collectionName.localeCompare(right.collectionName)
  );
}

export function collectionIdFromPaths(paths: string[]) {
  return createHash("sha1").update(paths.slice().sort().join("\0")).digest("hex").slice(0, 16);
}

/** Stable id for separate-files collections so mode file renames don't change selection. */
export function collectionIdFromName(collectionName: string) {
  return createHash("sha1")
    .update(`collection:${collectionName}`)
    .digest("hex")
    .slice(0, 16);
}

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
    id: collectionIdFromName(collectionName),
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
