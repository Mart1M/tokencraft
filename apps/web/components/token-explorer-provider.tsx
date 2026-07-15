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
  // Modes a user has added in this session but hasn't saved a token value for
  // yet, so they aren't derivable from `collections[].modes`. Keyed by
  // collection id since modes are per-collection.
  const [manualModesByCollection, setManualModesByCollection] = useState<
    Record<string, string[]>
  >({});
  const [activeMode, setActiveMode] = useState<string | null>(() =>
    collections[0]
      ? getCollectionDefaultActiveMode(collections[0].modes)
      : getCollectionDefaultActiveMode(fallbackModes)
  );

  const setSelectedCollectionId = useMemo(
    () => (id: string | null) => {
      setSelectedCollectionIdState(id);
      setSelectedGroupSegments(null);
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

  const availableModes = useMemo(() => {
    const base = getCollectionModes(collections, selectedCollectionId, fallbackModes);
    const manual = selectedCollectionId
      ? (manualModesByCollection[selectedCollectionId] ?? [])
      : [];

    return manual.length === 0 ? base : Array.from(new Set([...base, ...manual]));
  }, [collections, selectedCollectionId, fallbackModes, manualModesByCollection]);

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

      setManualModesByCollection((current) => {
        const existing = current[selectedCollectionId] ?? [];

        if (existing.includes(trimmed)) {
          return current;
        }

        return { ...current, [selectedCollectionId]: [...existing, trimmed] };
      });
      setActiveMode(trimmed);
    },
    [selectedCollectionId]
  );

  const renameCollectionMode = useMemo(
    () => (oldMode: string, newMode: string) => {
      const trimmedNew = newMode.trim();

      if (!trimmedNew || !selectedCollectionId) {
        return;
      }

      setManualModesByCollection((current) => {
        const existing = current[selectedCollectionId];

        if (!existing?.includes(oldMode)) {
          return current;
        }

        return {
          ...current,
          [selectedCollectionId]: existing.map((mode) =>
            mode === oldMode ? trimmedNew : mode
          ),
        };
      });

      setActiveMode((current) => (current === oldMode ? trimmedNew : current));
    },
    [selectedCollectionId]
  );

  const deleteCollectionMode = useMemo(
    () => (mode: string) => {
      if (!selectedCollectionId) {
        return;
      }

      setManualModesByCollection((current) => {
        const existing = current[selectedCollectionId];

        if (!existing?.includes(mode)) {
          return current;
        }

        return {
          ...current,
          [selectedCollectionId]: existing.filter((currentMode) => currentMode !== mode),
        };
      });

      setActiveMode((current) => (current === mode ? null : current));
    },
    [selectedCollectionId]
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
      addMode,
      renameCollectionMode,
      deleteCollectionMode,
    }),
    [
      activeMode,
      availableModes,
      resolvedMode,
      selectedCollectionId,
      setSelectedCollectionId,
      selectedGroupSegments,
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
