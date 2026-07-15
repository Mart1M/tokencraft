"use client";

import { useEffect, useRef, useState } from "react";

import { useWorkspaceData } from "@/components/workspace-data-provider";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

export type TokenAutoSaveStatus = "idle" | "saving" | "saved" | "error";

const AUTO_SAVE_DELAY_MS = 700;
const SAVED_STATUS_RESET_MS = 2000;

/**
 * Persists token drafts and pending collection deletes to disk automatically,
 * shortly after they change, instead of requiring an explicit "Save" action.
 */
export function useTokenAutoSave() {
  const { workspace, refresh } = useWorkspaceData();
  const drafts = useTokenDraftStore((state) => state.drafts);
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );
  const reset = useTokenDraftStore((state) => state.reset);

  const [status, setStatus] = useState<TokenAutoSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  const scheduleSave = useDebouncedCallback(async () => {
    if (!workspace || isSavingRef.current) {
      return;
    }

    const current = useTokenDraftStore.getState();

    if (
      Object.keys(current.drafts).length === 0 &&
      current.pendingCollectionDeletes.length === 0
    ) {
      return;
    }

    isSavingRef.current = true;
    setStatus("saving");
    setError(null);

    try {
      const response = await fetch("/api/workspaces/tokens/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootPath: workspace.rootPath,
          drafts: Object.values(current.drafts),
          pendingCollectionDeletes: current.pendingCollectionDeletes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Save failed.");
      }

      reset();
      await refresh();
      setStatus("saved");
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      isSavingRef.current = false;
    }
  }, AUTO_SAVE_DELAY_MS);

  const hasLocalEdits =
    Object.keys(drafts).length > 0 || pendingCollectionDeletes.length > 0;

  useEffect(() => {
    if (hasLocalEdits) {
      scheduleSave();
    }
    // scheduleSave reads the freshest store state itself; we only need to
    // re-trigger it when drafts/deletes change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, pendingCollectionDeletes]);

  useEffect(() => {
    if (status !== "saved") {
      return;
    }

    const timeout = setTimeout(() => setStatus("idle"), SAVED_STATUS_RESET_MS);
    return () => clearTimeout(timeout);
  }, [status]);

  return { status, error };
}
