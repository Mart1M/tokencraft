const DEFAULT_FILE_BASE_NAME = "my-set";

export function stripJsonExtension(fileName: string) {
  let base = fileName.trim();

  while (/\.json$/i.test(base)) {
    base = base.slice(0, -".json".length);
  }

  return base || DEFAULT_FILE_BASE_NAME;
}

export function ensureJsonExtension(fileName: string) {
  const base = stripJsonExtension(fileName);
  return `${base}.json`;
}

export function splitCollectionPath(fullPath: string) {
  const normalized = fullPath.trim().replace(/^\/+/, "");
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash === -1) {
    return {
      directory: "",
      fileBaseName: stripJsonExtension(normalized || DEFAULT_FILE_BASE_NAME),
    };
  }

  return {
    directory: normalized.slice(0, lastSlash),
    fileBaseName: stripJsonExtension(
      normalized.slice(lastSlash + 1) || DEFAULT_FILE_BASE_NAME,
    ),
  };
}

export function joinCollectionPath(directory: string, fileBaseName: string) {
  const trimmedDirectory = directory.trim().replace(/^\/+|\/+$/g, "");
  const fileName = ensureJsonExtension(fileBaseName);

  return trimmedDirectory ? `${trimmedDirectory}/${fileName}` : fileName;
}

export function normalizeCollectionPath(fullPath: string) {
  const { directory, fileBaseName } = splitCollectionPath(fullPath);
  return joinCollectionPath(directory, fileBaseName);
}

export function sanitizeFileBaseName(value: string) {
  return stripJsonExtension(value.replace(/\.json/gi, ""));
}
