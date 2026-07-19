"use client";

import { useMemo, useState } from "react";
import {
  BookText,
  Folder,
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

export function SidebarCollections({
  collections = [],
}: {
  collections?: TokenSidebarCollection[];
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
  const markCollectionForDelete = useTokenDraftStore((state) => state.markCollectionForDelete);
  const unmarkCollectionForDelete = useTokenDraftStore((state) => state.unmarkCollectionForDelete);
  const clearCollectionCreate = useTokenDraftStore((state) => state.clearCollectionCreate);
  const pendingCollectionDeletes = useTokenDraftStore((state) => state.pendingCollectionDeletes);
  const pendingCollectionCreates = useTokenDraftStore(
    (state) => state.pendingCollectionCreates,
  );
  const [contextCollection, setContextCollection] = useState<TokenSidebarCollection | null>(null);
  const [contextPosition, setContextPosition] = useState({ x: 0, y: 0 });

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
        ...(pendingCollectionDeletes.includes(collection.id) ? { pendingDelete: true } : {}),
      })),
      ...stagedCollections,
    ];
  }, [collections, pendingCollectionCreates, pendingCollectionDeletes]);

  const isSearching = searchQuery.trim().length > 0;

  const filteredCollections = displayedCollections.filter((collection) =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const tree = useMemo(
    () => buildCollectionTree(filteredCollections),
    [filteredCollections],
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
          ...(collection
            ? {
                onClick: () => setSelectedCollectionId(collection.id),
                onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  setSelectedCollectionId(collection.id);
                  setContextCollection(collection);
                  setContextPosition({ x: event.clientX, y: event.clientY });
                },
                className: collection.pendingDelete ? "text-muted-foreground line-through" : undefined,
              }
            : {}),
          ...(node.children.length
            ? { children: node.children.map(toTreeItem) }
            : {}),
        };
      }),
    [tree, setSelectedCollectionId],
  );

  function closeContextMenu() {
    setContextCollection(null);
  }

  function handleDeleteCollection() {
    const collection = contextCollection;
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

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {filteredCollections.length > 0 ? (
          <TreeView
            data={treeData}
            selectedItemId={selectedCollectionId ?? undefined}
            expandAll={isSearching}
            renderItem={({ item }) =>
              item.value?.collection ? (
                <>
                  <BookText className="h-4 w-4 shrink-0 text-muted-foreground" />
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
        <CreateCollectionDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          existingPaths={displayedCollections.map((collection) => collection.path)}
          onCreated={(path, collectionName) => {
            stageCollectionCreate({ path, collectionName });
          }}
        />
      ) : null}

      <DropdownMenu open={Boolean(contextCollection)} onOpenChange={(open) => !open && closeContextMenu()}>
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
          <DropdownMenuItem variant="destructive" onSelect={handleDeleteCollection}>
            <Trash2 />
            {contextCollection?.id.startsWith("create:")
              ? "Discard collection"
              : contextCollection?.pendingDelete
                ? "Restore collection"
                : "Delete collection"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
