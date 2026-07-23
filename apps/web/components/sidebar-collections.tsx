"use client";

import { useMemo, useState } from "react";
import {
  Diamond,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { useSidebarStore } from "@/lib/sidebar-store";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import { useTokenExplorer } from "@/components/token-explorer-provider";
import { useWorkspaceData } from "@/components/workspace-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TreeView, type TreeDataItem } from "@/components/ui/tree-view";
import { normalizeCollectionPath } from "@/lib/tokens/collection-path";
import {
  buildCollectionTree,
  type CollectionTreeNode,
} from "@/lib/tokens/collection-tree";

import type { TokenSidebarCollection } from "@/lib/tokens/entries";

function CreateCollectionDialog({
  open,
  onOpenChange,
  existingPaths,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPaths: string[];
  onCreated: (path: string, collectionName?: string) => void;
}) {
  const [path, setPath] = useState("tokens/my-set.tokens.json");
  const [collectionName, setCollectionName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const normalizedPath = normalizeCollectionPath(path);
    if (existingPaths.includes(normalizedPath)) {
      setError("A collection already exists at this path.");
      return;
    }

    onCreated(normalizedPath, collectionName.trim() || undefined);
    onOpenChange(false);
    setPath("tokens/my-set.tokens.json");
    setCollectionName("");
  }

  const normalizedPath = normalizeCollectionPath(path);
  const pathAlreadyUsed = existingPaths.includes(normalizedPath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-[min(100vw-2rem,32rem)] space-y-4 rounded-xl border bg-background p-6 text-foreground shadow-xl"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">New collection</h2>
          <p className="text-sm text-muted-foreground">
            Choose the JSON file path for this collection, relative to the
            workspace folder. It will be created when you review and save the
            pending changes.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="collection-path">
            File path
          </label>
          <Input
            id="collection-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="tokens/my-set.tokens.json"
            autoFocus
          />
          {pathAlreadyUsed ? (
            <p className="text-sm text-destructive">
              A collection already exists at this path.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="collection-name">
            Display name (optional)
          </label>
          <Input
            id="collection-name"
            value={collectionName}
            onChange={(event) => setCollectionName(event.target.value)}
            placeholder="My set"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pathAlreadyUsed || !path.trim()}
          >
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}

function parentFolderPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
}

function fileName(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function renamePath(path: string, renames: Array<{ oldPath: string; newPath: string }>) {
  return renames.reduce((current, rename) =>
    current === rename.oldPath || current.startsWith(`${rename.oldPath}/`)
      ? `${rename.newPath}${current.slice(rename.oldPath.length)}`
      : current, path);
}

function CreateFolderDialog({
  open,
  onOpenChange,
  parentPath,
  existingPaths,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPath: string;
  existingPaths: string[];
  onCreated: (path: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const normalizedName = name.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const path = [parentPath, normalizedName].filter(Boolean).join("/");
  const invalidName = !normalizedName || normalizedName.split("/").some((segment) => !segment || segment === "." || segment === "..");
  const pathAlreadyUsed = existingPaths.includes(path);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (invalidName) {
      setError("Enter a valid folder name.");
      return;
    }

    if (pathAlreadyUsed) {
      setError("A folder already exists at this path.");
      return;
    }

    onCreated(path);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              {parentPath
                ? `Create a folder in ${parentPath}. It will be created when you save your pending changes.`
                : "Create a folder in this workspace. It will be created when you save your pending changes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="folder-name">
              Folder name
            </label>
            <Input
              id="folder-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="tokens"
              autoFocus
            />
            {path ? <p className="text-xs text-muted-foreground">{path}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={invalidName || pathAlreadyUsed}>
              Create folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ open, onOpenChange, target, existingPaths, onRenamed }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { kind: "folder" | "collection"; path: string } | null;
  existingPaths: string[];
  onRenamed: (oldPath: string, newPath: string, kind: "folder" | "collection") => void;
}) {
  const [name, setName] = useState(() => target ? fileName(target.path) : "");
  const parentPath = target ? parentFolderPath(target.path) : "";
  const normalizedName = name.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const nextPath = target?.kind === "collection"
    ? normalizeCollectionPath([parentPath, normalizedName].filter(Boolean).join("/"))
    : [parentPath, normalizedName].filter(Boolean).join("/");
  const invalid = !normalizedName || normalizedName.split("/").some((segment) => !segment || segment === "." || segment === "..");
  const duplicate = Boolean(target && nextPath !== target.path && existingPaths.includes(nextPath));

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setName("");
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!target || invalid || duplicate || nextPath === target.path) return;
    onRenamed(target.path, nextPath, target.kind);
    handleOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent showCloseButton={false}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Rename {target?.kind === "folder" ? "folder" : "file"}</DialogTitle>
          <DialogDescription>The change will be applied when you save pending changes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="rename-path">Name</label>
          <Input id="rename-path" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          {nextPath ? <p className="text-xs text-muted-foreground">{nextPath}</p> : null}
          {duplicate ? <p className="text-sm text-destructive">A file or folder already exists at this path.</p> : null}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button><Button type="submit" disabled={invalid || duplicate || !target || nextPath === target.path}>Rename</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

type SidebarContextTarget =
  | { kind: "root"; path: "" }
  | { kind: "folder"; path: string }
  | { kind: "collection"; path: string; collection: TokenSidebarCollection };

export function SidebarCollections({
  collections = [],
  folders = [],
}: {
  collections?: TokenSidebarCollection[];
  folders?: string[];
}) {
  const { workspace } = useWorkspaceData();
  const { selectedCollectionId, setSelectedCollectionId } = useTokenExplorer();
  const [searchQuery, setSearchQuery] = useState("");
  const showCreateDialog = useSidebarStore(
    (state) => state.createCollectionDialogOpen,
  );
  const setShowCreateDialog = useSidebarStore(
    (state) => state.setCreateCollectionDialogOpen,
  );
  const stageCollectionCreate = useTokenDraftStore((state) => state.stageCollectionCreate);
  const stageFolderCreate = useTokenDraftStore((state) => state.stageFolderCreate);
  const markCollectionForDelete = useTokenDraftStore((state) => state.markCollectionForDelete);
  const unmarkCollectionForDelete = useTokenDraftStore((state) => state.unmarkCollectionForDelete);
  const clearCollectionCreate = useTokenDraftStore((state) => state.clearCollectionCreate);
  const pendingCollectionDeletes = useTokenDraftStore((state) => state.pendingCollectionDeletes);
  const pendingCollectionCreates = useTokenDraftStore(
    (state) => state.pendingCollectionCreates,
  );
  const pendingFolderCreates = useTokenDraftStore((state) => state.pendingFolderCreates);
  const pendingCollectionRenames = useTokenDraftStore((state) => state.pendingCollectionRenames);
  const pendingFolderRenames = useTokenDraftStore((state) => state.pendingFolderRenames);
  const stageCollectionRename = useTokenDraftStore((state) => state.stageCollectionRename);
  const stageFolderRename = useTokenDraftStore((state) => state.stageFolderRename);
  const [contextTarget, setContextTarget] = useState<SidebarContextTarget | null>(null);
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 });
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderParentPath, setFolderParentPath] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ kind: "folder" | "collection"; path: string } | null>(null);

  const displayedCollections = useMemo<TokenSidebarCollection[]>(() => {
    const existingPaths = new Set(collections.map((collection) => collection.path));
    const stagedCollections = Object.values(pendingCollectionCreates)
      .filter((change) => !existingPaths.has(change.path))
      .map((change) => ({
        id: change.id,
        name: change.collectionName ?? change.path,
        path: change.path,
        modes: ["Default"],
      }));

    return [
      ...collections.map((collection) => ({
        ...collection,
        path: renamePath(collection.path, [...Object.values(pendingFolderRenames), ...Object.values(pendingCollectionRenames)]),
        ...(pendingCollectionDeletes.includes(collection.id) ? { pendingDelete: true } : {}),
      })),
      ...stagedCollections,
    ];
  }, [collections, pendingCollectionCreates, pendingCollectionDeletes, pendingCollectionRenames, pendingFolderRenames]);

  const isSearching = searchQuery.trim().length > 0;
  const displayedFolders = useMemo(
    () => [...new Set([...folders, ...Object.values(pendingFolderCreates).map((change) => change.path)].map((path) => renamePath(path, Object.values(pendingFolderRenames))))],
    [folders, pendingFolderCreates, pendingFolderRenames],
  );

  const filteredCollections = displayedCollections.filter((collection) =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const tree = useMemo(
    () => buildCollectionTree(filteredCollections, displayedFolders),
    [filteredCollections, displayedFolders],
  );

  const treeData = useMemo<TreeDataItem<CollectionTreeNode>[]>(
    () =>
      tree.map(function toTreeItem(node): TreeDataItem<CollectionTreeNode> {
        const { collection } = node;

        return {
          id: node.id,
          name: node.label,
          value: node,
          title: collection?.name ?? node.label,
          ...(collection ? { onClick: () => setSelectedCollectionId(collection.id) } : {}),
          onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            if (collection) {
              setSelectedCollectionId(collection.id);
              setContextTarget({ kind: "collection", path: collection.path, collection });
            } else {
              setContextTarget({ kind: "folder", path: node.id });
            }
            setContextPosition({ x: event.clientX, y: event.clientY });
          },
          className: collection?.pendingDelete ? "text-muted-foreground line-through" : undefined,
          ...(node.children.length
            ? { children: node.children.map(toTreeItem) }
            : {}),
        };
      }),
    [tree, setSelectedCollectionId],
  );

  function closeContextMenu() {
    setContextTarget(null);
  }

  function openFolderDialog() {
    const target = contextTarget;
    if (!target) return;

    setFolderParentPath(
      target.kind === "folder"
        ? target.path
        : target.kind === "collection"
          ? parentFolderPath(target.path)
          : "",
    );
    setFolderDialogOpen(true);
    closeContextMenu();
  }

  function openRenameDialog() {
    if (!contextTarget || contextTarget.kind === "root") return;
    setRenameTarget({ kind: contextTarget.kind, path: contextTarget.path });
    closeContextMenu();
  }

  function handleDeleteCollection() {
    const collection = contextTarget?.kind === "collection" ? contextTarget.collection : null;
    if (!collection) return;

    if (collection.id.startsWith("create:")) {
      clearCollectionCreate(collection.id);
      closeContextMenu();
      return;
    }

    if (collection.pendingDelete) {
      unmarkCollectionForDelete(collection.id);
      closeContextMenu();
      return;
    }

    if (window.confirm(`Delete collection “${collection.name}”? The file will be deleted when you save the pending changes.`)) {
      markCollectionForDelete(collection.id);
    }
    closeContextMenu();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-3">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-8 w-full min-w-0 pl-8"
          style={{ paddingLeft: 34 }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full justify-start gap-2"
        onClick={() => setShowCreateDialog(true)}
      >
        <Plus className="h-4 w-4 shrink-0" />
        New collection
      </Button>

      <div
        className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        onContextMenu={(event) => {
          event.preventDefault();
          setContextTarget({ kind: "root", path: "" });
          setContextPosition({ x: event.clientX, y: event.clientY });
        }}
      >
        {tree.length > 0 ? (
          <TreeView
            data={treeData}
            selectedItemId={selectedCollectionId ?? undefined}
            expandAll={isSearching}
            renderItem={({ item }) =>
              item.value?.collection ? (
                <>
                  <Diamond className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.name}</span>
                </>
              ) : (
                <>
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.name}</span>
                </>
              )
            }
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            No token sets discovered yet.
          </div>
        )}
      </div>

      {workspace ? (
        <>
          <CreateCollectionDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            existingPaths={displayedCollections.map((collection) => collection.path)}
            onCreated={(path, collectionName) => {
              stageCollectionCreate({ path, collectionName });
            }}
          />
          <CreateFolderDialog
            open={folderDialogOpen}
            onOpenChange={setFolderDialogOpen}
            parentPath={folderParentPath}
            existingPaths={displayedFolders}
            onCreated={stageFolderCreate}
          />
          <RenameDialog
            key={renameTarget?.path ?? "rename"}
            open={Boolean(renameTarget)}
            onOpenChange={(open) => !open && setRenameTarget(null)}
            target={renameTarget}
            existingPaths={renameTarget?.kind === "folder" ? displayedFolders : displayedCollections.map((collection) => collection.path)}
            onRenamed={(oldPath, newPath, kind) => {
              if (kind === "folder") stageFolderRename(oldPath, newPath);
              else stageCollectionRename(oldPath, newPath);
            }}
          />
        </>
      ) : null}

      <DropdownMenu open={Boolean(contextTarget)} onOpenChange={(open) => !open && closeContextMenu()}>
        <DropdownMenuTrigger
          aria-hidden="true"
          style={{
            position: "fixed",
            left: contextPosition.x,
            top: contextPosition.y,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onSelect={openFolderDialog}>
            <FolderPlus />
            New folder
          </DropdownMenuItem>
          {contextTarget?.kind !== "root" ? <DropdownMenuItem onSelect={openRenameDialog}><Pencil /> Rename</DropdownMenuItem> : null}
          {contextTarget?.kind === "collection" ? (
            <DropdownMenuItem variant="destructive" onSelect={handleDeleteCollection}>
              <Trash2 />
              {contextTarget.collection.id.startsWith("create:")
                ? "Discard collection"
                : contextTarget.collection.pendingDelete
                  ? "Restore collection"
                  : "Delete collection"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
