"use client";

import { useEffect, useState } from "react";

import { useWorkspaceData } from "@/components/workspace-data-provider";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

export type TokenAutoSaveStatus = "idle" | "saving" | "saved" | "error";

/** Applies staged workspace changes only when the user confirms the review. */
export function useTokenAutoSave() {
  const { workspace, refresh } = useWorkspaceData();
  const drafts = useTokenDraftStore((state) => state.drafts);
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );
  const reset = useTokenDraftStore((state) => state.reset);
  const pendingCollectionCreates = useTokenDraftStore((state) => state.pendingCollectionCreates);
  const pendingFolderCreates = useTokenDraftStore((state) => state.pendingFolderCreates);
  const pendingCollectionRenames = useTokenDraftStore((state) => state.pendingCollectionRenames);
  const pendingFolderRenames = useTokenDraftStore((state) => state.pendingFolderRenames);
  const pendingModeChanges = useTokenDraftStore((state) => state.pendingModeChanges);

  const [status, setStatus] = useState<TokenAutoSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const hasLocalEdits =
    Object.keys(drafts).length > 0 ||
    pendingCollectionDeletes.length > 0 ||
    Object.keys(pendingCollectionCreates).length > 0 ||
    Object.keys(pendingFolderCreates).length > 0 ||
    Object.keys(pendingCollectionRenames).length > 0 ||
    Object.keys(pendingFolderRenames).length > 0 ||
    Object.keys(pendingModeChanges).length > 0;

  useEffect(() => {
    if (hasLocalEdits && status === "saved") {
      setStatus("idle");
    }
  }, [hasLocalEdits, status]);

  async function save() {
    if (!workspace || !hasLocalEdits || status === "saving") {
      return;
    }
    setStatus("saving");
    setError(null);

    try {
      const current = useTokenDraftStore.getState();
      const response = await fetch("/api/workspaces/changes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootPath: workspace.rootPath,
          drafts: Object.values(current.drafts),
          pendingCollectionDeletes: current.pendingCollectionDeletes,
          collectionCreates: Object.values(current.pendingCollectionCreates),
          folderCreates: Object.values(current.pendingFolderCreates),
          collectionRenames: Object.values(current.pendingCollectionRenames),
          folderRenames: Object.values(current.pendingFolderRenames),
          modeChanges: Object.values(current.pendingModeChanges),
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
    }
  }

  return { status, error, hasLocalEdits, save };
}
