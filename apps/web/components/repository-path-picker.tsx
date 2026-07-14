"use client";

import {
  ChevronRight,
  FileJson,
  Folder,
  Home,
  Loader2,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse } from "@/lib/api/read-json-response";
import {
  joinCollectionPath,
  normalizeCollectionPath,
  sanitizeFileBaseName,
  splitCollectionPath,
} from "@/lib/tokens/collection-path";
import { cn } from "@/lib/utils";

type RepositoryJsonFile = {
  path: string;
  sha: string;
  size: number;
};

type RepositoryFilesResponse = {
  files: RepositoryJsonFile[];
  importedPaths: string[];
};

type FolderNode = {
  name: string;
  path: string;
  folders: Map<string, FolderNode>;
  files: string[];
};

function ensureFolderPath(root: FolderNode, folderPath: string) {
  const parts = folderPath.split("/").filter(Boolean);
  let current = root;
  let currentPath = "";

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    if (!current.folders.has(part)) {
      current.folders.set(part, {
        name: part,
        path: currentPath,
        folders: new Map(),
        files: [],
      });
    }

    current = current.folders.get(part)!;
  }
}

function buildFolderTree(filePaths: string[], folderPaths: string[] = []) {
  const root: FolderNode = {
    name: "",
    path: "",
    folders: new Map(),
    files: [],
  };

  for (const folderPath of folderPaths) {
    ensureFolderPath(root, folderPath);
  }

  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    const fileName = parts.pop();

    if (!fileName) {
      continue;
    }

    let current = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!current.folders.has(part)) {
        current.folders.set(part, {
          name: part,
          path: currentPath,
          folders: new Map(),
          files: [],
        });
      }

      current = current.folders.get(part)!;
    }

    current.files.push(filePath);
  }

  return root;
}

function getFolderNode(root: FolderNode, directory: string) {
  if (!directory) {
    return root;
  }

  let current = root;

  for (const part of directory.split("/")) {
    const next = current.folders.get(part);

    if (!next) {
      return null;
    }

    current = next;
  }

  return current;
}

function getDefaultDirectory(root: FolderNode) {
  if (root.folders.has("tokens")) {
    return "tokens";
  }

  const firstFolder = [...root.folders.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  )[0];

  return firstFolder?.path ?? "";
}

export function RepositoryPathPicker({
  workspaceId,
  value,
  onChange,
  existingPaths = [],
}: {
  workspaceId: string;
  value: string;
  onChange: (path: string) => void;
  existingPaths?: string[];
}) {
  const [{ directory, fileBaseName }, setPathParts] = useState(() =>
    splitCollectionPath(value),
  );
  const [virtualFolders, setVirtualFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<RepositoryJsonFile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const hasAppliedDefaultPath = useRef(false);

  const filesApiPath = `/api/workspaces/${encodeURIComponent(workspaceId)}/repositories/files`;
  const existingPathSet = useMemo(
    () => new Set(existingPaths),
    [existingPaths],
  );

  useEffect(() => {
    const next = splitCollectionPath(value);
    setPathParts(next);
  }, [value]);

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      setIsLoading(true);
      setLoadError(null);

      const response = await fetch(filesApiPath, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const result = await readJsonResponse<RepositoryFilesResponse>(response);

      if (cancelled) {
        return;
      }

      if (result.error) {
        setLoadError(result.error);
        setFiles([]);
        setIsLoading(false);
        return;
      }

      const nextFiles = result.data?.files ?? [];
      setFiles(nextFiles);

      if (!hasAppliedDefaultPath.current) {
        const tree = buildFolderTree(nextFiles.map((file) => file.path));
        const defaultDirectory = getDefaultDirectory(tree);
        const defaultPath = joinCollectionPath(defaultDirectory, "my-set");

        if (defaultPath) {
          onChange(defaultPath);
        }

        hasAppliedDefaultPath.current = true;
      }

      setIsLoading(false);
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [filesApiPath, onChange]);

  const tree = useMemo(
    () =>
      buildFolderTree(
        files.map((file) => file.path),
        virtualFolders,
      ),
    [files, virtualFolders],
  );

  const currentNode = useMemo(
    () => getFolderNode(tree, directory) ?? tree,
    [directory, tree],
  );

  const breadcrumbParts = directory ? directory.split("/") : [];

  const sortedFolders = useMemo(
    () =>
      [...currentNode.folders.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [currentNode],
  );

  const sortedFiles = useMemo(
    () => [...currentNode.files].sort((a, b) => a.localeCompare(b)),
    [currentNode],
  );

  const selectedPath = joinCollectionPath(directory, fileBaseName);
  const selectedPathTaken = existingPathSet.has(selectedPath);

  function updatePath(nextDirectory: string, nextFileBaseName: string) {
    const sanitizedBaseName = sanitizeFileBaseName(nextFileBaseName);
    setPathParts({ directory: nextDirectory, fileBaseName: sanitizedBaseName });
    onChange(joinCollectionPath(nextDirectory, sanitizedBaseName));
  }

  function navigateToDirectory(nextDirectory: string) {
    updatePath(nextDirectory, fileBaseName);
  }

  function selectFile(path: string) {
    const next = splitCollectionPath(path);
    setPathParts(next);
    onChange(normalizeCollectionPath(path));
  }

  function handleFileBaseNameChange(rawValue: string) {
    updatePath(directory, rawValue);
  }

  function handleCreateFolder() {
    const trimmedName = newFolderName.trim().replace(/\/+/g, "");

    if (!trimmedName) {
      return;
    }

    const nextDirectory = directory
      ? `${directory}/${trimmedName}`
      : trimmedName;

    setVirtualFolders((current) =>
      current.includes(nextDirectory) ? current : [...current, nextDirectory],
    );
    updatePath(nextDirectory, fileBaseName);
    setNewFolderName("");
    setShowNewFolderInput(false);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted",
                directory === "" && "bg-muted font-medium",
              )}
              onClick={() => navigateToDirectory("")}
            >
              <Home size={14} />
              <span>root</span>
            </button>
            {breadcrumbParts.map((part, index) => {
              const partPath = breadcrumbParts.slice(0, index + 1).join("/");

              return (
                <div key={partPath} className="flex items-center gap-1">
                  <ChevronRight size={14} className="text-muted-foreground" />
                  <button
                    type="button"
                    className={cn(
                      "rounded px-1.5 py-0.5 hover:bg-muted",
                      directory === partPath && "bg-muted font-medium",
                    )}
                    onClick={() => navigateToDirectory(partPath)}
                  >
                    {part}
                  </button>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setShowNewFolderInput((current) => !current)}
          >
            <Plus size={14} />
            New folder
          </Button>
        </div>

        {showNewFolderInput ? (
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateFolder();
                }
              }}
              placeholder="Folder name"
              className="h-8"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              disabled={!newFolderName.trim()}
              onClick={handleCreateFolder}
            >
              Add
            </Button>
          </div>
        ) : null}

        <div className="max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              Loading repository files...
            </div>
          ) : loadError ? (
            <div className="space-y-2 px-3 py-4 text-sm">
              <p className="text-destructive">{loadError}</p>
              <p className="text-muted-foreground">
                You can still enter a path manually below.
              </p>
            </div>
          ) : sortedFolders.length === 0 && sortedFiles.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              This folder is empty. Add a file name below or create a subfolder.
            </p>
          ) : (
            <ul className="divide-y">
              {sortedFolders.map((folder) => (
                <li key={folder.path}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
                    onClick={() => navigateToDirectory(folder.path)}
                  >
                    <Folder
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="flex-1 truncate">{folder.name}</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                </li>
              ))}
              {sortedFiles.map((filePath) => {
                const fileNameOnly = filePath.split("/").pop() ?? filePath;
                const isSelected = selectedPath === filePath;
                const isTaken = existingPathSet.has(filePath);

                return (
                  <li key={filePath}>
                    <button
                      type="button"
                      disabled={isTaken}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40",
                        isSelected && "bg-primary/10 hover:bg-primary/10",
                        isTaken &&
                          "cursor-not-allowed opacity-50 hover:bg-transparent",
                      )}
                      onClick={() => selectFile(filePath)}
                    >
                      <FileJson
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="flex-1 truncate font-mono">
                        {fileNameOnly}
                      </span>
                      {isTaken ? (
                        <span className="text-xs text-muted-foreground">
                          in use
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="collection-file-name">
          File name
        </label>
        <div className="flex overflow-hidden rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <Input
            id="collection-file-name"
            value={fileBaseName}
            onChange={(event) => handleFileBaseNameChange(event.target.value)}
            placeholder="my-set"
            className="rounded-none border-0 font-mono shadow-none focus-visible:ring-0"
            required
          />
          <span className="inline-flex shrink-0 items-center border-l bg-muted/40 px-3 font-mono text-sm text-muted-foreground">
            .json
          </span>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {selectedPath}
        </p>
        {selectedPathTaken ? (
          <p className="text-xs text-destructive">
            A collection already exists at this path.
          </p>
        ) : null}
      </div>
    </div>
  );
}
