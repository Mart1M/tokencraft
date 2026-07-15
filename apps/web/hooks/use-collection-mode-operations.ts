"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { useTokenExplorer } from "@/components/token-explorer-provider";
import { useWorkspaceData } from "@/components/workspace-data-provider";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

export function useCollectionModeOperations() {
  const { workspace, refresh } = useWorkspaceData();
  const {
    availableModes,
    selectedCollectionId,
    renameCollectionMode: renameCollectionModeLocal,
    deleteCollectionMode: deleteCollectionModeLocal,
  } = useTokenExplorer();
  const renameModeDrafts = useTokenDraftStore((state) => state.renameModeDrafts);
  const deleteModeDrafts = useTokenDraftStore((state) => state.deleteModeDrafts);

  const renameMode = useCallback(
    async (oldMode: string, newMode: string) => {
      const trimmedNew = newMode.trim();

      if (!trimmedNew) {
        toast.error("Mode name is required.");
        return false;
      }

      if (trimmedNew === oldMode) {
        return true;
      }

      if (availableModes.includes(trimmedNew)) {
        toast.error(`Mode "${trimmedNew}" already exists.`);
        return false;
      }

      if (!selectedCollectionId) {
        return false;
      }

      if (workspace) {
        try {
          const response = await fetch("/api/workspaces/modes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "rename",
              rootPath: workspace.rootPath,
              fileId: selectedCollectionId,
              oldMode,
              newMode: trimmedNew,
              modes: availableModes.map((mode) =>
                mode === oldMode ? trimmedNew : mode
              ),
            }),
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(payload.error ?? "Failed to rename mode.");
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to rename mode."
          );
          return false;
        }

        await refresh();
      }

      renameCollectionModeLocal(oldMode, trimmedNew);
      renameModeDrafts(oldMode, trimmedNew);
      toast.success(`Renamed mode to "${trimmedNew}".`);
      return true;
    },
    [
      availableModes,
      refresh,
      renameCollectionModeLocal,
      renameModeDrafts,
      selectedCollectionId,
      workspace,
    ]
  );

  const deleteMode = useCallback(
    async (mode: string) => {
      if (availableModes.length <= 1) {
        toast.error("Cannot delete the last mode.");
        return false;
      }

      if (!selectedCollectionId) {
        return false;
      }

      if (workspace) {
        try {
          const response = await fetch("/api/workspaces/modes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete",
              rootPath: workspace.rootPath,
              fileId: selectedCollectionId,
              mode,
              modes: availableModes.filter((currentMode) => currentMode !== mode),
            }),
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(payload.error ?? "Failed to delete mode.");
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to delete mode."
          );
          return false;
        }

        await refresh();
      }

      deleteCollectionModeLocal(mode);
      deleteModeDrafts(mode);
      toast.success(`Deleted mode "${mode}".`);
      return true;
    },
    [
      availableModes,
      deleteCollectionModeLocal,
      deleteModeDrafts,
      refresh,
      selectedCollectionId,
      workspace,
    ]
  );

  return {
    renameMode,
    deleteMode,
    canDeleteMode: availableModes.length > 1,
  };
}
