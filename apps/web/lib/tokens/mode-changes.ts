import type { PendingModeChange } from "@/lib/tokens/draft-store";

export function modesEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((mode, index) => mode === right[index]);
}

/**
 * Map a displayed mode name back to the key still present in loaded token
 * data while a rename is staged but not yet saved/refreshed.
 */
export function resolveModeDataKey(
  displayMode: string,
  pendingModeChanges: PendingModeChange[],
  fileId: string | null | undefined
) {
  if (!fileId) {
    return displayMode;
  }

  const renames = pendingModeChanges.filter(
    (change) =>
      change.fileId === fileId &&
      change.action === "rename" &&
      Boolean(change.oldMode) &&
      Boolean(change.newMode)
  );

  if (renames.length === 0) {
    return displayMode;
  }

  // Newest renames first so chained Light→Day→Night resolves to Light.
  const ordered = [...renames].reverse();
  let key = displayMode;
  let changed = true;

  while (changed) {
    changed = false;

    for (const change of ordered) {
      if (key === change.newMode && change.oldMode) {
        key = change.oldMode;
        changed = true;
        break;
      }
    }
  }

  return key;
}
