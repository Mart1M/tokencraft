"use client";

import { FileJson, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type RepositoryJsonFile = {
  path: string;
  sha: string;
  size: number;
};

type RepositoryFilesResponse = {
  files: RepositoryJsonFile[];
  importedPaths: string[];
  tokencraftConfig: { found: true; files: string[] } | { found: false };
};

async function readJsonResponse<T>(response: Response) {
  if (response.status === 401) {
    return { authRequired: true as const };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      error: `Request failed (${response.status}). Please try again.`
    };
  }

  const payload = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;

  if (!response.ok) {
    return { error: payload?.error ?? "Something went wrong. Please try again." };
  }

  return { data: payload as T };
}

export function RepositoryFileBrowser({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<RepositoryJsonFile[]>([]);
  const [importedPaths, setImportedPaths] = useState<string[]>([]);
  const [tokencraftConfig, setTokencraftConfig] = useState<
    RepositoryFilesResponse["tokencraftConfig"] | null
  >(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const filesApiPath = `/api/workspaces/${encodeURIComponent(workspaceId)}/repositories/files`;
  const importApiPath = `/api/workspaces/${encodeURIComponent(workspaceId)}/repositories/files/import`;

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      setIsLoading(true);
      setLoadError(null);

      const response = await fetch(filesApiPath, {
        credentials: "same-origin",
        cache: "no-store"
      });
      const result = await readJsonResponse<RepositoryFilesResponse>(response);

      if (cancelled) {
        return;
      }

      if ("authRequired" in result && result.authRequired) {
        setLoadError("Authentication required. Refresh the page and try again.");
        return;
      }

      if ("error" in result && result.error) {
        setLoadError(result.error);
        setIsLoading(false);
        return;
      }

      const data = result.data!;
      setFiles(data.files);
      setImportedPaths(data.importedPaths);
      setTokencraftConfig(data.tokencraftConfig);

      const configPaths = data.tokencraftConfig.found ? data.tokencraftConfig.files : [];
      const availableConfigPaths = configPaths.filter((path) =>
        data.files.some((file) => file.path === path)
      );

      setSelectedPaths(
        data.importedPaths.length > 0
          ? data.importedPaths
          : availableConfigPaths.length > 0
            ? availableConfigPaths
            : data.importedPaths
      );
      setIsLoading(false);
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [filesApiPath, router]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return files;
    }

    return files.filter((file) => file.path.toLowerCase().includes(normalizedQuery));
  }, [files, query]);

  const allVisibleSelected =
    filteredFiles.length > 0 &&
    filteredFiles.every((file) => selectedPaths.includes(file.path));

  function togglePath(path: string) {
    setSelectedPaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visiblePaths = new Set(filteredFiles.map((file) => file.path));
      setSelectedPaths((current) => current.filter((path) => !visiblePaths.has(path)));
      return;
    }

    setSelectedPaths((current) => [
      ...current,
      ...filteredFiles.map((file) => file.path).filter((path) => !current.includes(path))
    ]);
  }

  function importSelected() {
    setActionError(null);
    startTransition(async () => {
      const response = await fetch(importApiPath, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: selectedPaths })
      });
      const result = await readJsonResponse<{ importedFileCount: number }>(response);

      if ("authRequired" in result && result.authRequired) {
        setActionError("Authentication required. Refresh the page and try again.");
        return;
      }

      if ("error" in result && result.error) {
        setActionError(result.error);
        return;
      }

      router.push(`/dashboard/workspaces/${encodeURIComponent(workspaceId)}/tokens`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter files..."
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isPending || selectedPaths.length === 0}
          onClick={importSelected}
        >
          <FileJson size={16} />
          Import {selectedPaths.length || ""}
        </Button>
      </div>

      {tokencraftConfig?.found ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">tokencraft.config.json</span> ·{" "}
          {tokencraftConfig.files.length} file
          {tokencraftConfig.files.length === 1 ? "" : "s"}
          {importedPaths.length === 0 ? " · pre-selected" : ""}
        </p>
      ) : null}

      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={isLoading || filteredFiles.length === 0}
                  aria-label="Select all visible JSON files"
                />
              </TableHead>
              <TableHead>Path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                  No JSON files found.
                </TableCell>
              </TableRow>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedPaths.includes(file.path);
                const isImported = importedPaths.includes(file.path);

                return (
                  <TableRow key={file.path}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePath(file.path)}
                        aria-label={`Select ${file.path}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {file.path}
                      {isImported ? (
                        <span className="ml-2 text-xs text-muted-foreground">imported</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
