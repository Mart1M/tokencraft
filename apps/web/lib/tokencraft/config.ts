import {
  TOKENCRAFT_CONFIG_FILENAME,
  type TokencraftConfigFile,
} from "@tokencraft/core";

export { TOKENCRAFT_CONFIG_FILENAME };

export const TOKENFLOW_CONFIG_FILENAME = "tokenflow.config.json";

const CONFIG_VERSION = 1 as const;

export type WorkspaceFileCollection = {
  name: string;
  modes?: string[];
};

export type ParsedWorkspaceConfig = TokencraftConfigFile & {
  fileCollections?: Record<string, WorkspaceFileCollection>;
  folders?: string[];
};

function normalizeFilePaths(paths: unknown) {
  if (!Array.isArray(paths)) {
    return [];
  }

  return [
    ...new Set(
      paths
        .filter((path): path is string => typeof path === "string")
        .map((path) => path.trim().replace(/\\/g, "/"))
        .filter(Boolean)
    ),
  ];
}

function normalizeFolderPaths(paths: unknown) {
  if (!Array.isArray(paths)) {
    return [];
  }

  return [
    ...new Set(
      paths
        .filter((folder): folder is string => typeof folder === "string")
        .map((folder) => folder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
        .filter((folder) => folder && !folder.split("/").includes("..")),
    ),
  ];
}

function normalizeModes(modes: unknown) {
  if (!Array.isArray(modes)) {
    return undefined;
  }

  const normalized = [
    ...new Set(
      modes
        .filter((mode): mode is string => typeof mode === "string")
        .map((mode) => mode.trim())
        .filter(Boolean)
    ),
  ];

  return normalized.length > 0 ? normalized : undefined;
}

function parseCollectionsConfig(
  collections: unknown
): Pick<ParsedWorkspaceConfig, "files" | "fileCollections"> | null {
  if (!Array.isArray(collections)) {
    return null;
  }

  const files: string[] = [];
  const fileCollections: Record<string, WorkspaceFileCollection> = {};

  for (const collection of collections) {
    if (!collection || typeof collection !== "object") {
      continue;
    }

    const record = collection as Record<string, unknown>;
    const name =
      typeof record.name === "string" ? record.name.trim() : "";
    const collectionFiles = normalizeFilePaths(record.files);
    const modes = normalizeModes(record.modes);

    if (!name || collectionFiles.length === 0) {
      continue;
    }

    for (const filePath of collectionFiles) {
      files.push(filePath);
      fileCollections[filePath] = { name, modes };
    }
  }

  const uniqueFiles = normalizeFilePaths(files);

  if (uniqueFiles.length === 0) {
    return null;
  }

  return { files: uniqueFiles, fileCollections };
}

export function parseTokencraftConfig(content: string): ParsedWorkspaceConfig | null {
  try {
    const json = JSON.parse(content) as Record<string, unknown>;
    const folders = normalizeFolderPaths(json.folders);

    if (Array.isArray(json.files)) {
      const files = normalizeFilePaths(json.files);

      if (files.length === 0 && folders.length === 0) {
        return null;
      }

      return { version: CONFIG_VERSION, files, ...(folders.length ? { folders } : {}) };
    }

    if (Array.isArray(json.sources)) {
      const files = normalizeFilePaths(
        json.sources.map((source) =>
          source && typeof source === "object" && "path" in source
            ? (source as { path?: unknown }).path
            : null
        )
      );

      if (files.length === 0 && folders.length === 0) {
        return null;
      }

      return { version: CONFIG_VERSION, files, ...(folders.length ? { folders } : {}) };
    }

    const collectionsConfig = parseCollectionsConfig(json.collections);

    if (collectionsConfig) {
      return {
        version: CONFIG_VERSION,
        files: collectionsConfig.files,
        fileCollections: collectionsConfig.fileCollections,
        ...(folders.length ? { folders } : {}),
      };
    }

    if (folders.length) {
      return { version: CONFIG_VERSION, files: [], folders };
    }

    return null;
  } catch {
    return null;
  }
}

export function serializeTokencraftConfig(files: string[], folders: string[] = []): string {
  const payload = {
    version: CONFIG_VERSION,
    files: normalizeFilePaths(files),
    ...(normalizeFolderPaths(folders).length ? { folders: normalizeFolderPaths(folders) } : {}),
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

function groupFileCollections(
  fileCollections: Record<string, WorkspaceFileCollection>
) {
  const grouped = new Map<
    string,
    { files: string[]; modes?: string[] }
  >();

  for (const [filePath, collection] of Object.entries(fileCollections)) {
    const existing = grouped.get(collection.name) ?? {
      files: [],
      modes: collection.modes,
    };

    existing.files.push(filePath);
    grouped.set(collection.name, existing);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, collection]) => ({
      name,
      files: normalizeFilePaths(collection.files),
      ...(collection.modes ? { modes: collection.modes } : {}),
    }));
}

export function buildTokencraftConfigContent(config: ParsedWorkspaceConfig): string {
  const folders = normalizeFolderPaths(config.folders);

  if (config.fileCollections && Object.keys(config.fileCollections).length > 0) {
    return `${JSON.stringify(
      {
        version: CONFIG_VERSION,
        collections: groupFileCollections(config.fileCollections),
        ...(folders.length ? { folders } : {}),
      },
      null,
      2
    )}\n`;
  }

  return serializeTokencraftConfig(config.files, folders);
}

export function parseForeignToolConfig(content: string): ParsedWorkspaceConfig | null {
  return parseTokencraftConfig(content);
}
