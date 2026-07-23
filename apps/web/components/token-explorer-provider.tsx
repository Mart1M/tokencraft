"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getDefaultMode } from "@/lib/tokens/display";
import { modesEqual } from "@/lib/tokens/mode-changes";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import type { TokenSidebarCollection } from "@/lib/tokens/entries";

type TokenExplorerContextValue = {
  activeMode: string | null;
  setActiveMode: (mode: string | null) => void;
  availableModes: string[];
  resolvedMode: string | null;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  selectedGroupSegments: string[] | null;
  setSelectedGroupSegments: (segments: string[] | null) => void;
  tokenSearchQuery: string;
  setTokenSearchQuery: (query: string) => void;
  addMode: (mode: string) => void;
  renameCollectionMode: (oldMode: string, newMode: string) => void;
  deleteCollectionMode: (mode: string) => void;
};

const TokenExplorerContext = createContext<TokenExplorerContextValue | null>(null);

function toActiveMode(mode: string | null) {
  return mode === "Default" ? null : mode;
}

function getCollectionDefaultActiveMode(modes: string[]) {
  return toActiveMode(getDefaultMode(modes));
}

function getCollectionModes(
  collections: TokenSidebarCollection[],
  selectedCollectionId: string | null,
  fallbackModes: string[]
) {
  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId
  );

  if (selectedCollection) {
    return selectedCollection.modes;
  }

  if (collections[0]) {
    return collections[0].modes;
  }

  return fallbackModes;
}

export function TokenExplorerProvider({
  children,
  availableModes: fallbackModes,
  collections = [],
}: {
  children: ReactNode;
  availableModes: string[];
  collections?: TokenSidebarCollection[];
}) {
  const [selectedCollectionId, setSelectedCollectionIdState] = useState<string | null>(
    () => collections[0]?.id ?? null
  );
  const [selectedGroupSegments, setSelectedGroupSegments] = useState<string[] | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
  // Full per-collection mode list while local add/rename/delete is staged but
  // collections from the server have not caught up yet.
  const [modeOverridesByCollection, setModeOverridesByCollection] = useState<
    Record<string, string[]>
  >({});
  const [activeMode, setActiveMode] = useState<string | null>(() =>
    collections[0]
      ? getCollectionDefaultActiveMode(collections[0].modes)
      : getCollectionDefaultActiveMode(fallbackModes)
  );
  const stageModeChange = useTokenDraftStore((state) => state.stageModeChange);

  const setSelectedCollectionId = useMemo(
    () => (id: string | null) => {
      setSelectedCollectionIdState(id);
      setSelectedGroupSegments(null);
      setTokenSearchQuery("");
    },
    []
  );

  useEffect(() => {
    if (collections.length === 0) {
      setSelectedCollectionIdState(null);
      setActiveMode(getCollectionDefaultActiveMode(fallbackModes));
      return;
    }

    setSelectedCollectionIdState((current) => {
      if (current && collections.some((collection) => collection.id === current)) {
        return current;
      }

      return collections[0]?.id ?? null;
    });
  }, [collections, fallbackModes]);

  useEffect(() => {
    setModeOverridesByCollection((current) => {
      let changed = false;
      const next = { ...current };

      for (const [collectionId, override] of Object.entries(current)) {
        const collection = collections.find((candidate) => candidate.id === collectionId);

        if (!collection) {
          delete next[collectionId];
          changed = true;
          continue;
        }

        if (modesEqual(override, collection.modes)) {
          delete next[collectionId];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [collections]);

  const availableModes = useMemo(() => {
    if (selectedCollectionId && modeOverridesByCollection[selectedCollectionId]) {
      return modeOverridesByCollection[selectedCollectionId];
    }

    return getCollectionModes(collections, selectedCollectionId, fallbackModes);
  }, [collections, selectedCollectionId, fallbackModes, modeOverridesByCollection]);

  useEffect(() => {
    setActiveMode((current) => {
      if (current && availableModes.includes(current)) {
        return current;
      }

      if (current === null && availableModes.includes("Default")) {
        return null;
      }

      return getCollectionDefaultActiveMode(availableModes);
    });
  }, [availableModes]);

  const addMode = useMemo(
    () => (mode: string) => {
      const trimmed = mode.trim();

      if (!trimmed || !selectedCollectionId) {
        return;
      }

      const baseModes = getCollectionModes(collections, selectedCollectionId, fallbackModes);
      const currentModes = modeOverridesByCollection[selectedCollectionId] ?? baseModes;

      if (currentModes.includes(trimmed)) {
        setActiveMode(trimmed);
        return;
      }

      const nextModes = [...currentModes, trimmed];

      setModeOverridesByCollection((current) => ({
        ...current,
        [selectedCollectionId]: nextModes,
      }));
      stageModeChange({
        fileId: selectedCollectionId,
        action: "add",
        mode: trimmed,
        modes: currentModes,
      });
      setActiveMode(trimmed);
    },
    [
      collections,
      fallbackModes,
      modeOverridesByCollection,
      selectedCollectionId,
      stageModeChange,
    ]
  );

  const renameCollectionMode = useMemo(
    () => (oldMode: string, newMode: string) => {
      const trimmedNew = newMode.trim();

      if (!trimmedNew || !selectedCollectionId) {
        return;
      }

      const baseModes = getCollectionModes(collections, selectedCollectionId, fallbackModes);

      setModeOverridesByCollection((current) => {
        const source = current[selectedCollectionId] ?? baseModes;

        if (!source.includes(oldMode)) {
          return current;
        }

        return {
          ...current,
          [selectedCollectionId]: source.map((mode) =>
            mode === oldMode ? trimmedNew : mode
          ),
        };
      });

      setActiveMode((current) => (current === oldMode ? trimmedNew : current));
    },
    [collections, fallbackModes, selectedCollectionId]
  );

  const deleteCollectionMode = useMemo(
    () => (mode: string) => {
      if (!selectedCollectionId) {
        return;
      }

      const baseModes = getCollectionModes(collections, selectedCollectionId, fallbackModes);

      setModeOverridesByCollection((current) => {
        const source = current[selectedCollectionId] ?? baseModes;

        if (!source.includes(mode)) {
          return current;
        }

        return {
          ...current,
          [selectedCollectionId]: source.filter((currentMode) => currentMode !== mode),
        };
      });

      setActiveMode((current) => (current === mode ? null : current));
    },
    [collections, fallbackModes, selectedCollectionId]
  );

  const resolvedMode = activeMode ?? getDefaultMode(availableModes);

  const value = useMemo(
    () => ({
      activeMode,
      setActiveMode,
      availableModes,
      resolvedMode,
      selectedCollectionId,
      setSelectedCollectionId,
      selectedGroupSegments,
      setSelectedGroupSegments,
      tokenSearchQuery,
      setTokenSearchQuery,
      addMode,
      renameCollectionMode,
      deleteCollectionMode,
    }),
    [
      activeMode,
      availableModes,
      resolvedMode,
      selectedCollectionId,
      selectedGroupSegments,
      tokenSearchQuery,
      addMode,
      renameCollectionMode,
      deleteCollectionMode,
    ]
  );

  return (
    <TokenExplorerContext.Provider value={value}>
      {children}
    </TokenExplorerContext.Provider>
  );
}

export function useTokenExplorer() {
  const context = useContext(TokenExplorerContext);

  if (!context) {
    throw new Error("useTokenExplorer must be used within TokenExplorerProvider");
  }

  return context;
}
