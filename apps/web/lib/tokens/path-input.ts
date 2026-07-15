/**
 * Cleans up a folder path pasted from Finder/Explorer or an "@" file
 * reference (e.g. `@"/Users/me/My Project/"`), so it can be used directly as
 * a workspace root. Safe to run on an already-clean path (no-op).
 */
export function sanitizeFolderPathInput(raw: string): string {
  let value = raw.trim();

  if (value.startsWith("@")) {
    value = value.slice(1).trim();
  }

  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];

    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1).trim();
    }
  }

  if (value.length > 1 && value.endsWith("/")) {
    value = value.slice(0, -1);
  }

  return value;
}
