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
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    () => collections[0]?.id ?? null
  );
  const [activeMode, setActiveMode] = useState<string | null>(() =>
    collections[0]
      ? getCollectionDefaultActiveMode(collections[0].modes)
      : getCollectionDefaultActiveMode(fallbackModes)
  );

  useEffect(() => {
    if (collections.length === 0) {
      setSelectedCollectionId(null);
      setActiveMode(getCollectionDefaultActiveMode(fallbackModes));
      return;
    }

    setSelectedCollectionId((current) => {
      if (current && collections.some((collection) => collection.id === current)) {
        return current;
      }

      return collections[0]?.id ?? null;
    });
  }, [collections, fallbackModes]);

  useEffect(() => {
    const selectedCollection = collections.find(
      (collection) => collection.id === selectedCollectionId
    );

    if (!selectedCollection) {
      return;
    }

    setActiveMode((current) => {
      if (current && selectedCollection.modes.includes(current)) {
        return current;
      }

      if (current === null && selectedCollection.modes.includes("Default")) {
        return null;
      }

      return getCollectionDefaultActiveMode(selectedCollection.modes);
    });
  }, [collections, selectedCollectionId]);

  const availableModes = useMemo(
    () => getCollectionModes(collections, selectedCollectionId, fallbackModes),
    [collections, selectedCollectionId, fallbackModes]
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
    }),
    [activeMode, availableModes, resolvedMode, selectedCollectionId]
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

export function isTokenExplorerModeActive(
  mode: string,
  activeMode: string | null,
  resolvedMode: string | null,
  availableModes: string[]
) {
  if (mode === "Default") {
    return activeMode === null && availableModes.includes("Default");
  }

  return resolvedMode === mode;
}
