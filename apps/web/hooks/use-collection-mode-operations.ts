"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { useTokenExplorer } from "@/components/token-explorer-provider";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";

export function useCollectionModeOperations() {
  const {
    availableModes,
    selectedCollectionId,
    renameCollectionMode: renameCollectionModeLocal,
    deleteCollectionMode: deleteCollectionModeLocal,
  } = useTokenExplorer();
  const renameModeDrafts = useTokenDraftStore((state) => state.renameModeDrafts);
  const deleteModeDrafts = useTokenDraftStore((state) => state.deleteModeDrafts);
  const stageModeChange = useTokenDraftStore((state) => state.stageModeChange);

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

      stageModeChange({
        fileId: selectedCollectionId,
        action: "rename",
        oldMode,
        newMode: trimmedNew,
        modes: availableModes,
      });
      renameCollectionModeLocal(oldMode, trimmedNew);
      renameModeDrafts(oldMode, trimmedNew);
      toast.success(`Mode rename staged.`);
      return true;
    },
    [
      availableModes,
      renameCollectionModeLocal,
      renameModeDrafts,
      selectedCollectionId,
      stageModeChange,
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

      stageModeChange({
        fileId: selectedCollectionId,
        action: "delete",
        mode,
        modes: availableModes,
      });
      deleteCollectionModeLocal(mode);
      deleteModeDrafts(mode);
      toast.success(`Mode deletion staged.`);
      return true;
    },
    [
      availableModes,
      deleteCollectionModeLocal,
      deleteModeDrafts,
      selectedCollectionId,
      stageModeChange,
    ]
  );

  return {
    renameMode,
    deleteMode,
    canDeleteMode: availableModes.length > 1,
  };
}
