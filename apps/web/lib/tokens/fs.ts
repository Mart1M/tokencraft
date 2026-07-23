import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import writeFileAtomic from "write-file-atomic";

import { type ModeStorage, type TokenFormat } from "@tokencraft/core";

import {
  TOKENCRAFT_CONFIG_FILENAME,
  TOKENFLOW_CONFIG_FILENAME,
  DEFAULT_MODE_STORAGE,
  buildTokencraftConfigContent,
  normalizeModeStorage,
  parseForeignToolConfig,
  parseTokencraftConfig,
  resolveModeStorage,
  type ParsedWorkspaceConfig,
} from "@/lib/tokencraft/config";
import { flattenTokenEntries, type TokenFileMetadata } from "@/lib/tokens/flatten";
import { buildJsonFromMetadata } from "@/lib/tokens/json-patch";
import {
  bindModesToFiles,
  detectSeparateModeGroups,
  mergeSeparateModeFiles,
  splitMetadataForModeFiles,
} from "@/lib/tokens/mode-storage";
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
  /** Present when the workspace stores one file per mode. */
  modeStorage?: ModeStorage;
  /** Mode name → relative file path when using separate-files storage. */
  modeFiles?: Record<string, string>;
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

export async function ensureTokencraftConfig(
  rootPath: string,
  options?: { modeStorage?: ModeStorage }
): Promise<boolean> {
  if (await tokencraftConfigExists(rootPath)) {
    return false;
  }

  const discovered = await discoverWorkspaceConfig(rootPath);
  const modeStorage = normalizeModeStorage(options?.modeStorage);

  if (!discovered?.files.length && !modeStorage) {
    return false;
  }

  const config: ParsedWorkspaceConfig = discovered
    ? {
        ...discovered,
        ...(modeStorage ? { modeStorage } : {}),
      }
    : {
        version: 1,
        files: [],
        ...(modeStorage ? { modeStorage } : {}),
      };

  await writeFileAtomic(
    path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
    buildTokencraftConfigContent(config),
    "utf8"
  );

  return true;
}

/**
 * Ensure a tokencraft.config.json exists with the given mode storage preference.
 * Used when opening/creating a workspace so the choice is persisted even before
 * token files are discovered.
 */
export async function initWorkspaceConfig(
  rootPath: string,
  options?: { modeStorage?: ModeStorage }
): Promise<{ created: boolean; modeStorage: ModeStorage }> {
  const existing = await readWorkspaceConfig(rootPath);

  if (existing) {
    return {
      created: false,
      modeStorage: resolveModeStorage(existing),
    };
  }

  const modeStorage = normalizeModeStorage(options?.modeStorage) ?? DEFAULT_MODE_STORAGE;
  const discovered = await discoverWorkspaceConfig(rootPath);
  const config: ParsedWorkspaceConfig = {
    version: 1,
    files: discovered?.files ?? [],
    ...(discovered?.fileCollections ? { fileCollections: discovered.fileCollections } : {}),
    ...(discovered?.folders ? { folders: discovered.folders } : {}),
    ...(modeStorage !== DEFAULT_MODE_STORAGE ? { modeStorage } : {}),
  };

  // Always write so an explicit value-map choice is still recorded when we
  // discovered files (or so an empty separate-files workspace has a config).
  if (modeStorage !== DEFAULT_MODE_STORAGE || config.files.length > 0 || (config.folders?.length ?? 0) > 0) {
    await writeFileAtomic(
      path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
      buildTokencraftConfigContent(config),
      "utf8"
    );
    return { created: true, modeStorage };
  }

  return { created: false, modeStorage };
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
  const modeStorage = resolveModeStorage(config);
  const relativePaths = await scanWorkspaceFiles(rootPath);
  const files: LocalTokenFile[] = [];

  for (const relativePath of relativePaths) {
    try {
      const content = await fs.readFile(toAbsolutePath(rootPath, relativePath), "utf8");
      const inspected = inspectTokenJson(relativePath, content);
      const collectionConfig = config?.fileCollections?.[relativePath];

      files.push({
        ...inspected,
        modeStorage,
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

  if (modeStorage !== "separate-files") {
    return files.sort((left, right) => left.path.localeCompare(right.path));
  }

  return mergeTokenFilesByCollection(files, config);
}

function mergeTokenFilesByCollection(
  files: LocalTokenFile[],
  config: ParsedWorkspaceConfig | null
): LocalTokenFile[] {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const grouped = new Map<string, { modes?: string[]; paths: string[] }>();
  const consumedPaths = new Set<string>();

  for (const [filePath, collection] of Object.entries(config?.fileCollections ?? {})) {
    const existing = grouped.get(collection.name) ?? {
      modes: collection.modes,
      paths: [],
    };

    if (!existing.modes && collection.modes) {
      existing.modes = collection.modes;
    }

    existing.paths.push(filePath);
    grouped.set(collection.name, existing);
  }

  const merged: LocalTokenFile[] = [];

  for (const [collectionName, group] of [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const uniquePaths = [...new Set(group.paths)];
    const bindings = bindModesToFiles(group.modes, uniquePaths);

    if (bindings.length === 0) {
      continue;
    }

    const modeFiles = bindings
      .map((binding) => {
        const file = filesByPath.get(binding.path);
        return file ? { mode: binding.mode, file } : null;
      })
      .filter((entry): entry is { mode: string; file: LocalTokenFile } => entry !== null);

    if (modeFiles.length === 0) {
      continue;
    }

    for (const binding of bindings) {
      consumedPaths.add(binding.path);
    }

    merged.push(
      mergeSeparateModeFiles({
        collectionName,
        modeFiles,
        modeStorage: "separate-files",
      })
    );
  }

  const remaining = files.filter((file) => !consumedPaths.has(file.path));
  const detectedGroups = detectSeparateModeGroups(
    remaining.map((file) => ({
      path: file.path,
      tokenPaths: file.metadata.tokens.map((token) => token.path),
    }))
  );

  for (const group of detectedGroups) {
    const modeFiles = group.paths
      .map((filePath, index) => {
        const file = filesByPath.get(filePath);
        return file ? { mode: group.modes[index], file } : null;
      })
      .filter((entry): entry is { mode: string; file: LocalTokenFile } => entry !== null);

    if (modeFiles.length < 2) {
      continue;
    }

    for (const filePath of group.paths) {
      consumedPaths.add(filePath);
    }

    merged.push(
      mergeSeparateModeFiles({
        collectionName: group.collectionName,
        modeFiles,
        modeStorage: "separate-files",
      })
    );
  }

  for (const file of files) {
    if (!consumedPaths.has(file.path)) {
      merged.push(file);
    }
  }

  return merged.sort((left, right) => left.collectionName.localeCompare(right.collectionName));
}

export async function writeWorkspaceRawFiles(
  rootPath: string,
  files: Array<{ path: string; content: string }>,
): Promise<{ savedFileCount: number }> {
  if (files.length === 0) {
    return { savedFileCount: 0 };
  }

  let savedFileCount = 0;

  for (const file of files) {
    const absolutePath = toAbsolutePath(rootPath, file.path);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFileAtomic(absolutePath, file.content, "utf8");
    savedFileCount += 1;
  }

  return { savedFileCount };
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

    if (file.modeStorage === "separate-files" && file.modeFiles) {
      const parts = splitMetadataForModeFiles(metadata, file.modeFiles);

      for (const part of parts) {
        const content = `${JSON.stringify(buildJsonFromMetadata(part.metadata), null, 2)}\n`;
        await writeFileAtomic(toAbsolutePath(rootPath, part.path), content, "utf8");
        savedFileCount += 1;
      }

      continue;
    }

    const content = `${JSON.stringify(buildJsonFromMetadata(metadata), null, 2)}\n`;
    await writeFileAtomic(toAbsolutePath(rootPath, file.path), content, "utf8");
    savedFileCount += 1;
  }

  for (const fileId of input.pendingCollectionDeletes ?? []) {
    const file = filesById.get(fileId);

    if (!file) {
      continue;
    }

    const pathsToDelete =
      file.modeStorage === "separate-files" && file.modeFiles
        ? Object.values(file.modeFiles)
        : [file.path];

    for (const relativePath of pathsToDelete) {
      try {
        await fs.unlink(toAbsolutePath(rootPath, relativePath));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await unregisterFileInWorkspaceConfig(rootPath, relativePath);
      savedFileCount += 1;
    }
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

function validateFolderPath(relativePath: string) {
  const normalized = relativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!normalized) {
    throw new WorkspaceFsError("Folder path is required.");
  }

  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new WorkspaceFsError("Folder path is invalid.");
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
  collectionName?: string,
  modes?: string[],
) {
  const config =
    (await readWorkspaceConfig(rootPath)) ??
    (await discoverWorkspaceConfig(rootPath)) ?? {
      version: 1,
      files: [],
    };

  const name = collectionName?.trim();
  const existingCollection = config.fileCollections?.[relativePath];
  if (
    config.files.includes(relativePath)
    && (!name || (existingCollection?.name === name && JSON.stringify(existingCollection.modes ?? []) === JSON.stringify(modes ?? [])))
  ) {
    return;
  }

  const updated: ParsedWorkspaceConfig = {
    ...config,
    files: [...new Set([...config.files, relativePath])],
    ...(name
      ? {
          fileCollections: {
            ...config.fileCollections,
            [relativePath]: {
              name,
              ...(modes?.length ? { modes } : {}),
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

async function registerFolderInWorkspaceConfig(rootPath: string, relativePath: string) {
  const config =
    (await readWorkspaceConfig(rootPath)) ??
    (await discoverWorkspaceConfig(rootPath)) ?? {
      version: 1,
      files: [],
    };
  const folders = [...new Set([...(config.folders ?? []), relativePath])];

  await writeFileAtomic(
    path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
    buildTokencraftConfigContent({ ...config, folders }),
    "utf8",
  );
}

async function unregisterFileInWorkspaceConfig(rootPath: string, relativePath: string) {
  const config = await readWorkspaceConfig(rootPath);
  if (!config?.files.includes(relativePath)) return;

  const fileCollections = config.fileCollections
    ? Object.fromEntries(
        Object.entries(config.fileCollections).filter(([path]) => path !== relativePath),
      )
    : undefined;
  const updated: ParsedWorkspaceConfig = {
    ...config,
    files: config.files.filter((path) => path !== relativePath),
    ...(fileCollections ? { fileCollections } : {}),
  };

  await writeFileAtomic(
    path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
    buildTokencraftConfigContent(updated),
    "utf8",
  );
}

export async function createTokenFile(
  rootPath: string,
  relativePath: string,
  collectionName?: string
): Promise<LocalTokenFile> {
  const normalized = validateCollectionPath(relativePath);
  const absolutePath = toAbsolutePath(rootPath, normalized);
  const config = await readWorkspaceConfig(rootPath);
  const modeStorage = resolveModeStorage(config);

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

  const explicitName = collectionName?.trim();
  const name =
    explicitName ||
    (modeStorage === "separate-files" ? formatCollectionName(normalized) : undefined);
  const modes = modeStorage === "separate-files" ? ["Default"] : undefined;
  await registerFileInWorkspaceConfig(rootPath, normalized, name, modes);

  const inspected = inspectTokenJson(normalized, "{}");

  if (modeStorage === "separate-files") {
    return {
      ...inspected,
      collectionName: name ?? inspected.collectionName,
      configuredModes: ["Default"],
      modeStorage,
      modeFiles: { Default: normalized },
    };
  }

  return {
    ...inspected,
    ...(explicitName ? { collectionName: explicitName } : {}),
    modeStorage,
  };
}

export async function createWorkspaceFolder(rootPath: string, relativePath: string) {
  const normalized = validateFolderPath(relativePath);
  const absolutePath = toAbsolutePath(rootPath, normalized);

  try {
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      throw new WorkspaceFsError("A folder already exists at this path.", 409);
    }
    throw new WorkspaceFsError("A file already exists at this path.", 409);
  } catch (error) {
    if (error instanceof WorkspaceFsError) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(absolutePath, { recursive: true });
  await registerFolderInWorkspaceConfig(rootPath, normalized);
}

export async function getWorkspaceFolderPaths(rootPath: string) {
  const config = await readWorkspaceConfig(rootPath);
  const folders: string[] = [];

  for (const relativePath of config?.folders ?? []) {
    try {
      const stats = await fs.stat(toAbsolutePath(rootPath, relativePath));
      if (stats.isDirectory()) {
        folders.push(relativePath);
      }
    } catch {
      // Ignore folders removed outside TokenCraft.
    }
  }

  return folders;
}

function replacePathPrefix(value: string, oldPath: string, newPath: string) {
  return value === oldPath || value.startsWith(`${oldPath}/`)
    ? `${newPath}${value.slice(oldPath.length)}`
    : value;
}

async function assertRenameDestination(sourcePath: string, destinationPath: string) {
  try {
    await fs.access(destinationPath);
    throw new WorkspaceFsError("A file or folder already exists at the new path.", 409);
  } catch (error) {
    if (error instanceof WorkspaceFsError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await fs.access(sourcePath);
}

export async function renameWorkspaceFolder(rootPath: string, oldPath: string, newPath: string) {
  const oldRelativePath = validateFolderPath(oldPath);
  const newRelativePath = validateFolderPath(newPath);
  const sourcePath = toAbsolutePath(rootPath, oldRelativePath);
  const destinationPath = toAbsolutePath(rootPath, newRelativePath);
  await assertRenameDestination(sourcePath, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.rename(sourcePath, destinationPath);

  const config = await readWorkspaceConfig(rootPath);
  if (!config) return;
  const fileCollections = config.fileCollections
    ? Object.fromEntries(Object.entries(config.fileCollections).map(([filePath, collection]) => [replacePathPrefix(filePath, oldRelativePath, newRelativePath), collection]))
    : undefined;
  await writeFileAtomic(path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME), buildTokencraftConfigContent({
    ...config,
    files: config.files.map((filePath) => replacePathPrefix(filePath, oldRelativePath, newRelativePath)),
    folders: config.folders?.map((folderPath) => replacePathPrefix(folderPath, oldRelativePath, newRelativePath)),
    ...(fileCollections ? { fileCollections } : {}),
  }), "utf8");
}

export async function renameWorkspaceTokenFile(rootPath: string, oldPath: string, newPath: string) {
  const oldRelativePath = validateCollectionPath(oldPath);
  const newRelativePath = validateCollectionPath(newPath);
  const sourcePath = toAbsolutePath(rootPath, oldRelativePath);
  const destinationPath = toAbsolutePath(rootPath, newRelativePath);
  await assertRenameDestination(sourcePath, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.rename(sourcePath, destinationPath);

  const config = await readWorkspaceConfig(rootPath);
  if (!config) return;
  const fileCollections = config.fileCollections
    ? Object.fromEntries(Object.entries(config.fileCollections).map(([filePath, collection]) => [filePath === oldRelativePath ? newRelativePath : filePath, collection]))
    : undefined;
  await writeFileAtomic(path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME), buildTokencraftConfigContent({
    ...config,
    files: config.files.map((filePath) => filePath === oldRelativePath ? newRelativePath : filePath),
    ...(fileCollections ? { fileCollections } : {}),
  }), "utf8");
}

export type FigmaCollectionExportInput = {
  name: string;
  modes: string[];
  tokens: Array<{
    name: string;
    type: "color" | "number" | "boolean" | "string";
    values: Record<string, string | number | boolean>;
  }>;
};

function toFigmaExportPath(collectionName: string) {
  const slug = collectionName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "collection"}.tokens.json`;
}

function setDtcgToken(target: Record<string, unknown>, token: FigmaCollectionExportInput["tokens"][number], modes: string[]) {
  const segments = token.name.split("/").map((segment) => segment.trim()).filter(Boolean);
  if (!segments.length) return;

  let group = target;
  for (const segment of segments.slice(0, -1)) {
    const existing = group[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      group[segment] = {};
    }
    group = group[segment] as Record<string, unknown>;
  }

  const defaultMode = modes.find((mode) => mode.toLowerCase() === "default") ?? modes[0];
  const value = modes.length <= 1
    ? token.values[defaultMode] ?? Object.values(token.values)[0]
    : Object.fromEntries(
        modes
          .filter((mode) => token.values[mode] !== undefined)
          .map((mode) => [mode, token.values[mode]]),
      );

  if (value === undefined) return;
  group[segments.at(-1)!] = { $type: token.type, $value: value };
}

export async function exportFigmaCollection(
  rootPath: string,
  input: FigmaCollectionExportInput,
) {
  const name = input.name.trim();
  if (!name) throw new WorkspaceFsError("Figma collection name is required.");
  if (!input.tokens.length) throw new WorkspaceFsError("Figma collection has no supported Variables.");

  const relativePath = toFigmaExportPath(name);
  const absolutePath = toAbsolutePath(rootPath, relativePath);
  try {
    await fs.access(absolutePath);
    throw new WorkspaceFsError("A TokenCraft collection already exists at this export path.", 409);
  } catch (error) {
    if (error instanceof WorkspaceFsError) throw error;
  }

  const document: Record<string, unknown> = {};
  const modes = input.modes.length ? input.modes : ["Default"];
  for (const token of input.tokens) setDtcgToken(document, token, modes);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFileAtomic(absolutePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await registerFileInWorkspaceConfig(rootPath, relativePath, name, modes);

  return inspectTokenJson(relativePath, JSON.stringify(document));
}
