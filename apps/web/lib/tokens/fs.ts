import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import writeFileAtomic from "write-file-atomic";

import { type TokenFormat } from "@tokencraft/core";

import {
  TOKENCRAFT_CONFIG_FILENAME,
  TOKENFLOW_CONFIG_FILENAME,
  buildTokencraftConfigContent,
  parseForeignToolConfig,
  parseTokencraftConfig,
  type ParsedWorkspaceConfig,
} from "@/lib/tokencraft/config";
import { flattenTokenEntries, type TokenFileMetadata } from "@/lib/tokens/flatten";
import { buildJsonFromMetadata } from "@/lib/tokens/json-patch";
import type { TokenDraft } from "@/lib/tokens/draft-utils";
import { applyDraftsToMetadata } from "@/lib/workspaces/token-edit-operations";

export class WorkspaceFsError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "WorkspaceFsError";
  }
}

const DEFAULT_GLOB = ["**/*.tokens.json"];
const GENERIC_TOKEN_GLOB = ["tokens/**/*.json", "**/*.json"];
const IGNORE_GLOB = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/.next/**",
  "**/.tokenflow/**",
];
const FOREIGN_TOOL_CONFIGS = [TOKENFLOW_CONFIG_FILENAME];
const IGNORED_JSON_FILENAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "jsconfig.json",
  "components.json",
  "vercel.json",
  TOKENCRAFT_CONFIG_FILENAME,
  TOKENFLOW_CONFIG_FILENAME,
]);

export type LocalTokenFile = {
  id: string;
  path: string;
  collectionName: string;
  configuredModes?: string[];
  format: TokenFormat;
  tokenCount: number;
  metadata: TokenFileMetadata;
};

function toAbsolutePath(rootPath: string, relativePath: string) {
  const normalizedRoot = path.resolve(rootPath);
  const resolved = path.resolve(normalizedRoot, relativePath);

  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new WorkspaceFsError("Path escapes the workspace root.", 400);
  }

  return resolved;
}

export async function assertDirectory(rootPath: string) {
  try {
    const stats = await fs.stat(rootPath);

    if (!stats.isDirectory()) {
      throw new WorkspaceFsError("Path is not a directory.", 400);
    }
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      throw error;
    }

    throw new WorkspaceFsError("Path does not exist.", 404);
  }
}

async function tokencraftConfigExists(rootPath: string) {
  try {
    await fs.access(path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME));
    return true;
  } catch {
    return false;
  }
}

async function readWorkspaceConfig(rootPath: string): Promise<ParsedWorkspaceConfig | null> {
  try {
    const raw = await fs.readFile(
      path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
      "utf8"
    );
    return parseTokencraftConfig(raw);
  } catch {
    return null;
  }
}

async function readForeignToolConfig(
  rootPath: string
): Promise<ParsedWorkspaceConfig | null> {
  for (const filename of FOREIGN_TOOL_CONFIGS) {
    try {
      const raw = await fs.readFile(path.join(rootPath, filename), "utf8");
      const parsed = parseForeignToolConfig(raw);

      if (parsed?.files.length) {
        return parsed;
      }
    } catch {
      // Try the next known foreign config filename.
    }
  }

  return null;
}

function shouldSkipJsonCandidate(relativePath: string) {
  const fileName = path.basename(relativePath).toLowerCase();

  if (IGNORED_JSON_FILENAMES.has(fileName)) {
    return true;
  }

  if (fileName.endsWith(".config.json")) {
    return true;
  }

  return false;
}

async function discoverNativeTokenFiles(rootPath: string) {
  const matches = await fg(DEFAULT_GLOB, {
    cwd: rootPath,
    ignore: IGNORE_GLOB,
    onlyFiles: true,
    dot: false,
  });

  return matches.sort();
}

async function discoverGenericTokenJsonFiles(
  rootPath: string
): Promise<ParsedWorkspaceConfig | null> {
  const matches = await fg(GENERIC_TOKEN_GLOB, {
    cwd: rootPath,
    ignore: IGNORE_GLOB,
    onlyFiles: true,
    dot: false,
  });

  const tokenFiles: string[] = [];

  for (const relativePath of [...new Set(matches)].sort()) {
    if (shouldSkipJsonCandidate(relativePath)) {
      continue;
    }

    try {
      const content = await fs.readFile(
        toAbsolutePath(rootPath, relativePath),
        "utf8"
      );
      const inspected = inspectTokenJson(relativePath, content);

      if (inspected.tokenCount > 0) {
        tokenFiles.push(relativePath);
      }
    } catch {
      // Skip invalid JSON or non-token files.
    }
  }

  if (tokenFiles.length === 0) {
    return null;
  }

  return {
    version: 1,
    files: tokenFiles,
  };
}

export async function discoverWorkspaceConfig(
  rootPath: string
): Promise<ParsedWorkspaceConfig | null> {
  const foreignConfig = await readForeignToolConfig(rootPath);

  if (foreignConfig) {
    return foreignConfig;
  }

  const nativeFiles = await discoverNativeTokenFiles(rootPath);

  if (nativeFiles.length > 0) {
    return {
      version: 1,
      files: nativeFiles,
    };
  }

  return discoverGenericTokenJsonFiles(rootPath);
}

export async function ensureTokencraftConfig(rootPath: string): Promise<boolean> {
  if (await tokencraftConfigExists(rootPath)) {
    return false;
  }

  const discovered = await discoverWorkspaceConfig(rootPath);

  if (!discovered?.files.length) {
    return false;
  }

  await writeFileAtomic(
    path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
    buildTokencraftConfigContent(discovered),
    "utf8"
  );

  return true;
}

export async function scanWorkspaceFiles(rootPath: string): Promise<string[]> {
  const config = await readWorkspaceConfig(rootPath);

  if (config?.files.length) {
    const existingFiles: string[] = [];

    for (const relativePath of config.files) {
      try {
        const stats = await fs.stat(toAbsolutePath(rootPath, relativePath));

        if (stats.isFile()) {
          existingFiles.push(relativePath);
        }
      } catch {
        // Skip configured paths that are missing on disk.
      }
    }

    return existingFiles.sort();
  }

  const matches = await fg(DEFAULT_GLOB, {
    cwd: rootPath,
    ignore: IGNORE_GLOB,
    onlyFiles: true,
    dot: false,
  });

  return matches.sort();
}

function formatCollectionName(relativePath: string) {
  const withoutExtension = relativePath
    .replace(/\.tokens?\.json$/i, "")
    .replace(/\.json$/i, "");

  const segments = withoutExtension
    .split("/")
    .map((segment) =>
      segment
        .replace(/[-_]+/g, " ")
        .replace(/\btokens?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  // Many multi-file token exports reuse the same leaf filename across
  // folders (e.g. "component/button/web.json" and
  // "component/badge/web.json"), so the full path is kept to produce a
  // unique, legible collection name. Consecutive duplicate segments (e.g.
  // "core/core.json") are collapsed to avoid redundant repetition.
  const deduped = segments.filter(
    (segment, index) =>
      index === 0 || segment.toLowerCase() !== segments[index - 1].toLowerCase()
  );

  return deduped.length > 0 ? deduped.join(" / ") : relativePath;
}

function countTokenNodes(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }

  const record = value as Record<string, unknown>;
  const isToken = "$value" in record || "value" in record;
  let count = isToken ? 1 : 0;

  for (const child of Object.values(record)) {
    count += countTokenNodes(child);
  }

  return count;
}

function guessTokenFormat(value: unknown): TokenFormat {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "custom";
  }

  const serialized = JSON.stringify(value).slice(0, 20000);

  if (serialized.includes('"$value"') || serialized.includes('"$type"')) {
    return "dtcg";
  }

  if (serialized.includes('"value"') && serialized.includes('"type"')) {
    return "tokens-studio";
  }

  return "custom";
}

function fileIdFromPath(relativePath: string) {
  return createHash("sha1").update(relativePath).digest("hex").slice(0, 16);
}

export function inspectTokenJson(relativePath: string, content: string): LocalTokenFile {
  const json = JSON.parse(content) as unknown;
  const tokens = flattenTokenEntries(json);
  const topLevelKeys =
    json && typeof json === "object" && !Array.isArray(json)
      ? Object.keys(json as Record<string, unknown>).slice(0, 20)
      : [];

  return {
    id: fileIdFromPath(relativePath),
    path: relativePath,
    collectionName: formatCollectionName(relativePath),
    format: guessTokenFormat(json),
    tokenCount: countTokenNodes(json),
    metadata: { topLevelKeys, tokens },
  };
}

export async function readWorkspaceTokenFiles(rootPath: string): Promise<LocalTokenFile[]> {
  await ensureTokencraftConfig(rootPath);

  const config = await readWorkspaceConfig(rootPath);
  const relativePaths = await scanWorkspaceFiles(rootPath);
  const files: LocalTokenFile[] = [];

  for (const relativePath of relativePaths) {
    try {
      const content = await fs.readFile(toAbsolutePath(rootPath, relativePath), "utf8");
      const inspected = inspectTokenJson(relativePath, content);
      const collectionConfig = config?.fileCollections?.[relativePath];

      files.push({
        ...inspected,
        ...(collectionConfig?.name
          ? { collectionName: collectionConfig.name }
          : {}),
        ...(collectionConfig?.modes
          ? { configuredModes: collectionConfig.modes }
          : {}),
      });
    } catch {
      // Skip files that fail to parse as JSON and keep scanning the rest.
    }
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function writeWorkspaceTokenDrafts(
  rootPath: string,
  input: {
    drafts: TokenDraft[];
    pendingCollectionDeletes?: string[];
  }
): Promise<{ savedFileCount: number }> {
  if (input.drafts.length === 0 && !input.pendingCollectionDeletes?.length) {
    throw new WorkspaceFsError("No token edits to save.", 400);
  }

  const files = await readWorkspaceTokenFiles(rootPath);
  const filesById = new Map(files.map((file) => [file.id, file]));

  const draftsByFile = new Map<string, TokenDraft[]>();
  for (const draft of input.drafts) {
    const current = draftsByFile.get(draft.fileId) ?? [];
    current.push(draft);
    draftsByFile.set(draft.fileId, current);
  }

  let savedFileCount = 0;

  for (const [fileId, fileDrafts] of draftsByFile) {
    const file = filesById.get(fileId);

    if (!file || !fileDrafts.length) {
      continue;
    }

    const metadata = applyDraftsToMetadata(file.metadata, fileDrafts);
    const content = `${JSON.stringify(buildJsonFromMetadata(metadata), null, 2)}\n`;

    await writeFileAtomic(toAbsolutePath(rootPath, file.path), content, "utf8");
    savedFileCount += 1;
  }

  for (const fileId of input.pendingCollectionDeletes ?? []) {
    const file = filesById.get(fileId);

    if (!file) {
      continue;
    }

    await fs.unlink(toAbsolutePath(rootPath, file.path)).catch(() => {});
    savedFileCount += 1;
  }

  return { savedFileCount };
}

function validateCollectionPath(relativePath: string) {
  const normalized = relativePath.trim().replace(/^\/+/, "");

  if (!normalized) {
    throw new WorkspaceFsError("Collection path is required.");
  }

  if (!normalized.toLowerCase().endsWith(".json")) {
    throw new WorkspaceFsError("Collection path must end with .json.");
  }

  if (normalized.includes("..")) {
    throw new WorkspaceFsError("Collection path is invalid.");
  }

  return normalized;
}

// `scanWorkspaceFiles` only returns files listed in tokencraft.config.json
// once one exists, and the auto-discovery heuristics (native glob aside)
// ignore JSON files with zero tokens — a brand new, still-empty collection
// would otherwise be invisible until it has content. Explicitly recording it
// here, bootstrapping the config file if needed, keeps it visible immediately.
async function registerFileInWorkspaceConfig(
  rootPath: string,
  relativePath: string,
  collectionName?: string
) {
  const config =
    (await readWorkspaceConfig(rootPath)) ??
    (await discoverWorkspaceConfig(rootPath)) ?? {
      version: 1,
      files: [],
    };

  if (config.files.includes(relativePath)) {
    return;
  }

  const updated: ParsedWorkspaceConfig = {
    ...config,
    files: [...config.files, relativePath],
    ...(config.fileCollections
      ? {
          fileCollections: {
            ...config.fileCollections,
            [relativePath]: {
              name: collectionName?.trim() || formatCollectionName(relativePath),
            },
          },
        }
      : {}),
  };

  await writeFileAtomic(
    path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
    buildTokencraftConfigContent(updated),
    "utf8"
  );
}

export async function createTokenFile(
  rootPath: string,
  relativePath: string,
  collectionName?: string
): Promise<LocalTokenFile> {
  const normalized = validateCollectionPath(relativePath);
  const absolutePath = toAbsolutePath(rootPath, normalized);

  try {
    await fs.access(absolutePath);
    throw new WorkspaceFsError("A collection already exists at this path.", 409);
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFileAtomic(absolutePath, "{}\n", "utf8");
  await registerFileInWorkspaceConfig(rootPath, normalized, collectionName);

  return inspectTokenJson(normalized, "{}");
}
