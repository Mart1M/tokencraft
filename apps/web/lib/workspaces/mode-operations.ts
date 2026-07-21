import fs from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

import {
  TOKENCRAFT_CONFIG_FILENAME,
  buildTokencraftConfigContent,
  parseTokencraftConfig,
  resolveModeStorage,
  type ParsedWorkspaceConfig,
  type WorkspaceFileCollection,
} from "@/lib/tokencraft/config";
import { looksLikeModeMap } from "@/lib/tokens/display";
import type { StoredTokenEntry, TokenFileMetadata } from "@/lib/tokens/flatten";
import { buildJsonFromMetadata } from "@/lib/tokens/json-patch";
import {
  renameModeFilePath,
  suggestModeFilePath,
} from "@/lib/tokens/mode-storage";
import type { StoredTokenRawValue } from "@/lib/tokens/raw-value";
import {
  readWorkspaceTokenFiles,
  WorkspaceFsError,
  type LocalTokenFile,
} from "@/lib/tokens/fs";

export class ModeOperationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "ModeOperationError";
  }
}

function toAbsolutePath(rootPath: string, relativePath: string) {
  return path.join(rootPath, relativePath);
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

function normalizeModeName(mode: string) {
  return mode.trim();
}

function replaceModeInModesList(modes: string[], oldMode: string, newMode: string) {
  const trimmedNew = normalizeModeName(newMode);

  if (!trimmedNew) {
    throw new ModeOperationError("Mode name is required.");
  }

  if (trimmedNew === oldMode) {
    return modes;
  }

  if (modes.includes(trimmedNew)) {
    throw new ModeOperationError(`Mode "${trimmedNew}" already exists.`);
  }

  const index = modes.indexOf(oldMode);

  if (index === -1) {
    throw new ModeOperationError(`Mode "${oldMode}" was not found.`);
  }

  const next = [...modes];
  next[index] = trimmedNew;
  return next;
}

function removeModeFromModesList(modes: string[], mode: string) {
  if (modes.length <= 1) {
    throw new ModeOperationError("Cannot delete the last mode.");
  }

  if (!modes.includes(mode)) {
    throw new ModeOperationError(`Mode "${mode}" was not found.`);
  }

  return modes.filter((currentMode) => currentMode !== mode);
}

function addModeToModesList(modes: string[], mode: string) {
  const trimmedMode = normalizeModeName(mode);

  if (!trimmedMode) {
    throw new ModeOperationError("Mode name is required.");
  }

  if (modes.includes(trimmedMode)) {
    throw new ModeOperationError(`Mode "${trimmedMode}" already exists.`);
  }

  return [...modes, trimmedMode];
}

function renameModeInEntry(
  entry: StoredTokenEntry,
  oldMode: string,
  newMode: string
): StoredTokenEntry {
  let changed = false;
  const next: StoredTokenEntry = { ...entry };

  if (next.modes?.[oldMode]) {
    const modes = { ...next.modes };
    modes[newMode] = modes[oldMode];
    delete modes[oldMode];
    next.modes = modes;
    changed = true;
  }

  if (
    next.raw &&
    typeof next.raw === "object" &&
    !Array.isArray(next.raw) &&
    looksLikeModeMap(next.raw as Record<string, unknown>) &&
    oldMode in (next.raw as Record<string, unknown>)
  ) {
    const raw = { ...(next.raw as Record<string, StoredTokenRawValue>) };
    raw[newMode] = raw[oldMode];
    delete raw[oldMode];
    next.raw = raw;
    changed = true;
  }

  return changed ? next : entry;
}

function deleteModeFromEntry(entry: StoredTokenEntry, mode: string): StoredTokenEntry {
  let changed = false;
  const next: StoredTokenEntry = { ...entry };

  if (next.modes?.[mode]) {
    const modes = { ...next.modes };
    delete modes[mode];

    if (Object.keys(modes).length === 0) {
      delete next.modes;
    } else {
      next.modes = modes;
    }

    changed = true;
  }

  if (
    next.raw &&
    typeof next.raw === "object" &&
    !Array.isArray(next.raw) &&
    looksLikeModeMap(next.raw as Record<string, unknown>) &&
    mode in (next.raw as Record<string, unknown>)
  ) {
    const raw = { ...(next.raw as Record<string, StoredTokenRawValue>) };
    delete raw[mode];

    if (Object.keys(raw).length === 0) {
      delete next.raw;
    } else {
      next.raw = raw;
    }

    changed = true;
  }

  return changed ? next : entry;
}

function applyModeRenameToMetadata(
  metadata: TokenFileMetadata,
  oldMode: string,
  newMode: string
) {
  return {
    ...metadata,
    tokens: metadata.tokens.map((entry) => renameModeInEntry(entry, oldMode, newMode)),
  };
}

function applyModeDeleteToMetadata(metadata: TokenFileMetadata, mode: string) {
  return {
    ...metadata,
    tokens: metadata.tokens.map((entry) => deleteModeFromEntry(entry, mode)),
  };
}

async function writeTokenFile(
  rootPath: string,
  file: LocalTokenFile,
  metadata: TokenFileMetadata
) {
  const content = `${JSON.stringify(buildJsonFromMetadata(metadata), null, 2)}\n`;
  await writeFileAtomic(toAbsolutePath(rootPath, file.path), content, "utf8");
}

function ensureFileCollections(
  config: ParsedWorkspaceConfig,
  files: LocalTokenFile[]
): Record<string, WorkspaceFileCollection> {
  const result = { ...(config.fileCollections ?? {}) };

  for (const file of files) {
    if (file.modeFiles) {
      for (const relativePath of Object.values(file.modeFiles)) {
        if (result[relativePath]) {
          continue;
        }

        result[relativePath] = {
          name: file.collectionName,
          ...(file.configuredModes ? { modes: file.configuredModes } : {}),
        };
      }
      continue;
    }

    if (result[file.path]) {
      continue;
    }

    result[file.path] = {
      name: file.collectionName,
      ...(file.configuredModes ? { modes: file.configuredModes } : {}),
    };
  }

  for (const filePath of config.files) {
    if (result[filePath]) {
      continue;
    }

    const file = files.find((candidate) => candidate.path === filePath);

    result[filePath] = {
      name: file?.collectionName ?? filePath,
    };
  }

  return result;
}

async function writeConfig(rootPath: string, config: ParsedWorkspaceConfig) {
  await writeFileAtomic(
    path.join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
    buildTokencraftConfigContent(config),
    "utf8"
  );
}

async function updateConfigModes(
  rootPath: string,
  file: LocalTokenFile,
  modes: string[],
  files: LocalTokenFile[],
  modeFiles?: Record<string, string>
) {
  const config = await readWorkspaceConfig(rootPath);

  if (!config) {
    throw new ModeOperationError("Workspace config not found.");
  }

  const fileCollections = ensureFileCollections(config, files);
  const bindings = modeFiles ?? file.modeFiles;

  if (bindings && Object.keys(bindings).length > 0) {
    // Drop previous paths for this collection, then re-register in mode order.
    for (const [filePath, collection] of Object.entries(fileCollections)) {
      if (collection.name === file.collectionName) {
        delete fileCollections[filePath];
      }
    }

    const orderedPaths = modes
      .map((modeName) => bindings[modeName])
      .filter((relativePath): relativePath is string => Boolean(relativePath));

    for (const relativePath of orderedPaths) {
      fileCollections[relativePath] = {
        name: file.collectionName,
        modes,
      };
    }

    const otherFiles = config.files.filter((candidate) => {
      const collection = config.fileCollections?.[candidate];
      return collection?.name !== file.collectionName;
    });

    const updated: ParsedWorkspaceConfig = {
      ...config,
      files: [...new Set([...otherFiles, ...orderedPaths])],
      fileCollections,
    };

    await writeConfig(rootPath, updated);
    return;
  }

  const existing = fileCollections[file.path] ?? { name: file.collectionName };

  fileCollections[file.path] = {
    ...existing,
    modes,
  };

  const updated: ParsedWorkspaceConfig = {
    ...config,
    fileCollections,
  };

  await writeConfig(rootPath, updated);
}

async function getCollectionFile(rootPath: string, fileId: string) {
  const files = await readWorkspaceTokenFiles(rootPath);
  const file = files.find((candidate) => candidate.id === fileId);

  if (!file) {
    throw new ModeOperationError("Collection not found.", 404);
  }

  return { file, files };
}

export async function renameWorkspaceCollectionMode(
  rootPath: string,
  input: {
    fileId: string;
    oldMode: string;
    newMode: string;
    modes: string[];
  }
) {
  const oldMode = normalizeModeName(input.oldMode);
  const newMode = normalizeModeName(input.newMode);

  if (!oldMode || !newMode) {
    throw new ModeOperationError("Mode name is required.");
  }

  const nextModes = replaceModeInModesList(input.modes, oldMode, newMode);
  const { file, files } = await getCollectionFile(rootPath, input.fileId);
  const config = await readWorkspaceConfig(rootPath);
  const modeStorage = resolveModeStorage(config);

  if (modeStorage === "separate-files" && file.modeFiles?.[oldMode]) {
    const oldPath = file.modeFiles[oldMode];
    const suggestedPath = renameModeFilePath(oldPath, oldMode, newMode);
    let nextPath = suggestedPath;

    if (nextPath !== oldPath) {
      const absoluteOld = toAbsolutePath(rootPath, oldPath);
      const absoluteNew = toAbsolutePath(rootPath, nextPath);

      try {
        await fs.access(absoluteNew);
        nextPath = oldPath;
      } catch {
        await fs.mkdir(path.dirname(absoluteNew), { recursive: true });
        await fs.rename(absoluteOld, absoluteNew);
      }
    }

    const nextModeFiles = { ...file.modeFiles };
    delete nextModeFiles[oldMode];
    nextModeFiles[newMode] = nextPath;

    await updateConfigModes(rootPath, file, nextModes, files, nextModeFiles);
    return { modes: nextModes };
  }

  const metadata = applyModeRenameToMetadata(file.metadata, oldMode, newMode);
  await writeTokenFile(rootPath, file, metadata);
  await updateConfigModes(rootPath, file, nextModes, files);

  return { modes: nextModes };
}

export async function addWorkspaceCollectionMode(
  rootPath: string,
  input: {
    fileId: string;
    mode: string;
    modes: string[];
  }
) {
  const mode = normalizeModeName(input.mode);
  const nextModes = addModeToModesList(input.modes, mode);
  const { file, files } = await getCollectionFile(rootPath, input.fileId);
  const config = await readWorkspaceConfig(rootPath);
  const modeStorage = resolveModeStorage(config);

  if (modeStorage === "separate-files") {
    const existingModeFiles = file.modeFiles ?? {};
    const relativePath = suggestModeFilePath(existingModeFiles, mode);
    const absolutePath = toAbsolutePath(rootPath, relativePath);

    try {
      await fs.access(absolutePath);
      throw new ModeOperationError(`A mode file already exists at "${relativePath}".`, 409);
    } catch (error) {
      if (error instanceof ModeOperationError) {
        throw error;
      }
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFileAtomic(absolutePath, "{}\n", "utf8");

    const nextModeFiles = {
      ...existingModeFiles,
      [mode]: relativePath,
    };

    await updateConfigModes(rootPath, file, nextModes, files, nextModeFiles);
    return { modes: nextModes };
  }

  await updateConfigModes(rootPath, file, nextModes, files);

  return { modes: nextModes };
}

export async function deleteWorkspaceCollectionMode(
  rootPath: string,
  input: {
    fileId: string;
    mode: string;
    modes: string[];
  }
) {
  const mode = normalizeModeName(input.mode);

  if (!mode) {
    throw new ModeOperationError("Mode name is required.");
  }

  const nextModes = removeModeFromModesList(input.modes, mode);
  const { file, files } = await getCollectionFile(rootPath, input.fileId);
  const config = await readWorkspaceConfig(rootPath);
  const modeStorage = resolveModeStorage(config);

  if (modeStorage === "separate-files" && file.modeFiles?.[mode]) {
    const relativePath = file.modeFiles[mode];

    try {
      await fs.unlink(toAbsolutePath(rootPath, relativePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const nextModeFiles = { ...file.modeFiles };
    delete nextModeFiles[mode];

    await updateConfigModes(rootPath, file, nextModes, files, nextModeFiles);
    return { modes: nextModes };
  }

  const metadata = applyModeDeleteToMetadata(file.metadata, mode);
  await writeTokenFile(rootPath, file, metadata);
  await updateConfigModes(rootPath, file, nextModes, files);

  return { modes: nextModes };
}

export function toModeOperationError(error: unknown): ModeOperationError {
  if (error instanceof ModeOperationError) {
    return error;
  }

  if (error instanceof WorkspaceFsError) {
    return new ModeOperationError(error.message, error.status);
  }

  throw error;
}
