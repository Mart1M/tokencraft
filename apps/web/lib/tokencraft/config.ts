import {
  TOKENCRAFT_CONFIG_FILENAME,
  type TokencraftConfigFile,
} from "@tokencraft/core";

export { TOKENCRAFT_CONFIG_FILENAME };

const CONFIG_VERSION = 1 as const;

function normalizeFilePaths(paths: unknown) {
  if (!Array.isArray(paths)) {
    return [];
  }

  return [
    ...new Set(
      paths
        .filter((path): path is string => typeof path === "string")
        .map((path) => path.trim())
        .filter(Boolean)
    ),
  ];
}

export function parseTokencraftConfig(content: string): TokencraftConfigFile | null {
  try {
    const json = JSON.parse(content) as Record<string, unknown>;

    if (Array.isArray(json.files)) {
      const files = normalizeFilePaths(json.files);

      if (files.length === 0) {
        return null;
      }

      return { version: CONFIG_VERSION, files };
    }

    if (Array.isArray(json.sources)) {
      const files = normalizeFilePaths(
        json.sources.map((source) =>
          source && typeof source === "object" && "path" in source
            ? (source as { path?: unknown }).path
            : null
        )
      );

      if (files.length === 0) {
        return null;
      }

      return { version: CONFIG_VERSION, files };
    }

    return null;
  } catch {
    return null;
  }
}

export function serializeTokencraftConfig(files: string[]): string {
  const payload: TokencraftConfigFile = {
    version: CONFIG_VERSION,
    files: normalizeFilePaths(files),
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
