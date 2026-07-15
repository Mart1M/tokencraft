"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { LocalWorkspace } from "@tokencraft/core";
import type { ImportedTokenRow, TokenSidebarCollection } from "@/lib/tokens/entries";
import { getWorkspace, setLastOpenedWorkspaceId } from "@/lib/workspaces/local-store";

type WorkspaceTokenData = {
  tokens: ImportedTokenRow[];
  collections: TokenSidebarCollection[];
  modes: string[];
  tokenFileCount: number;
};

type WorkspaceDataContextValue = {
  workspace: LocalWorkspace | null;
  data: WorkspaceTokenData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | null>(null);

export function WorkspaceDataProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<LocalWorkspace | null>(null);
  const [resolved, setResolved] = useState(false);
  const [data, setData] = useState<WorkspaceTokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const found = getWorkspace(workspaceId);
    setWorkspace(found);
    setResolved(true);

    if (!found) {
      router.replace("/dashboard");
      return;
    }

    setLastOpenedWorkspaceId(found.id);
  }, [workspaceId, router]);

  const refresh = useCallback(async () => {
    if (!workspace) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/tokens?root=${encodeURIComponent(workspace.rootPath)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as WorkspaceTokenData & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load tokens.");
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tokens.");
    } finally {
      setIsLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (workspace) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  return (
    <WorkspaceDataContext.Provider
      value={{ workspace, data, isLoading: !resolved || isLoading, error, refresh }}
    >
      {children}
    </WorkspaceDataContext.Provider>
  );
}

export function useWorkspaceData() {
  const context = useContext(WorkspaceDataContext);

  if (!context) {
    throw new Error("useWorkspaceData must be used within WorkspaceDataProvider");
  }

  return context;
}
