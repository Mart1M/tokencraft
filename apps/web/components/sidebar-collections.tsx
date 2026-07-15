"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, FolderOpen, Plus, Search, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import { useTokenExplorer } from "@/components/token-explorer-provider";
import { useWorkspaceData } from "@/components/workspace-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeCollectionPath } from "@/lib/tokens/collection-path";
import {
  buildCollectionTree,
  getCollectionAncestorIds,
  type CollectionTreeNode,
} from "@/lib/tokens/collection-tree";

import type { TokenSidebarCollection } from "@/lib/tokens/entries";

function CreateCollectionDialog({
  open,
  onOpenChange,
  rootPath,
  existingPaths,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootPath: string;
  existingPaths: string[];
  onCreated: () => void;
}) {
  const [path, setPath] = useState("tokens/my-set.tokens.json");
  const [collectionName, setCollectionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const normalizedPath = normalizeCollectionPath(path);

    try {
      const response = await fetch("/api/workspaces/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootPath,
          path: normalizedPath,
          ...(collectionName.trim()
            ? { collectionName: collectionName.trim() }
            : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create collection.");
      }

      onCreated();
      onOpenChange(false);
      setPath("tokens/my-set.tokens.json");
      setCollectionName("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create collection.",
      );
    } finally {
      setIsPending(false);
    }
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
            workspace folder. It is created immediately on disk.
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
            disabled={isPending || pathAlreadyUsed || !path.trim()}
          >
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}

function CollectionTreeRow({
  node,
  depth,
  expanded,
  expandAll,
  toggleExpanded,
  selectedCollectionId,
  onSelectCollection,
  onDeleteCollection,
  isPendingDelete,
}: {
  node: CollectionTreeNode;
  depth: number;
  expanded: Set<string>;
  expandAll: boolean;
  toggleExpanded: (id: string) => void;
  selectedCollectionId: string | null;
  onSelectCollection: (id: string) => void;
  onDeleteCollection: (collection: TokenSidebarCollection) => void;
  isPendingDelete: (collection: TokenSidebarCollection) => boolean;
}) {
  const { collection } = node;
  const isExpanded = expandAll || expanded.has(node.id);
  const isSelected = collection ? selectedCollectionId === collection.id : false;
  const pendingDelete = collection ? isPendingDelete(collection) : false;

  return (
    <div>
      <div className="group flex items-center gap-1">
        <button
          type="button"
          onClick={() => node.children.length > 0 && toggleExpanded(node.id)}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground",
            node.children.length === 0 && "invisible",
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          tabIndex={node.children.length === 0 ? -1 : 0}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-150",
              isExpanded && "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() =>
            collection ? onSelectCollection(collection.id) : toggleExpanded(node.id)
          }
          title={collection?.name ?? node.label}
          style={{ paddingLeft: depth * 12 }}
          className={cn(
            "box-border flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-sm transition-colors",
            isSelected
              ? "bg-accent text-foreground"
              : "text-foreground/80 hover:bg-accent",
            pendingDelete && "opacity-60 line-through",
          )}
        >
          {collection ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.label}</span>
        </button>
        {collection ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 opacity-0 group-hover:opacity-100"
            onClick={() => onDeleteCollection(collection)}
            aria-label={`Delete ${collection.name}`}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        ) : (
          <div className="h-8 w-8 shrink-0" aria-hidden="true" />
        )}
      </div>
      {isExpanded
        ? node.children.map((child) => (
            <CollectionTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              expandAll={expandAll}
              toggleExpanded={toggleExpanded}
              selectedCollectionId={selectedCollectionId}
              onSelectCollection={onSelectCollection}
              onDeleteCollection={onDeleteCollection}
              isPendingDelete={isPendingDelete}
            />
          ))
        : null}
    </div>
  );
}

export function SidebarCollections({
  collections = [],
}: {
  collections?: TokenSidebarCollection[];
}) {
  const { workspace, refresh } = useWorkspaceData();
  const { selectedCollectionId, setSelectedCollectionId } = useTokenExplorer();
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );
  const markCollectionForDelete = useTokenDraftStore(
    (state) => state.markCollectionForDelete,
  );
  const unmarkCollectionForDelete = useTokenDraftStore(
    (state) => state.unmarkCollectionForDelete,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const showCreateDialog = useSidebarStore(
    (state) => state.createCollectionDialogOpen,
  );
  const setShowCreateDialog = useSidebarStore(
    (state) => state.setCreateCollectionDialogOpen,
  );

  const isSearching = searchQuery.trim().length > 0;

  const filteredCollections = collections.filter((collection) => {
    if (pendingCollectionDeletes.includes(collection.id)) {
      return true;
    }

    return collection.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const tree = useMemo(
    () => buildCollectionTree(filteredCollections),
    [filteredCollections],
  );

  useEffect(() => {
    if (!selectedCollectionId) {
      return;
    }

    const collection = collections.find(
      (candidate) => candidate.id === selectedCollectionId,
    );

    if (!collection) {
      return;
    }

    const ancestorIds = getCollectionAncestorIds(collection.path);

    if (ancestorIds.length === 0) {
      return;
    }

    setExpanded((current) => {
      const next = new Set(current);
      let changed = false;

      for (const id of ancestorIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [selectedCollectionId, collections]);

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function isPendingDelete(collection: TokenSidebarCollection) {
    return (
      collection.pendingDelete || pendingCollectionDeletes.includes(collection.id)
    );
  }

  function handleDeleteCollection(collection: TokenSidebarCollection) {
    if (pendingCollectionDeletes.includes(collection.id)) {
      unmarkCollectionForDelete(collection.id);
      return;
    }

    const confirmed = window.confirm(
      `Delete collection "${collection.name}"? It will be removed from disk when you save.`,
    );

    if (!confirmed) {
      return;
    }

    if (selectedCollectionId === collection.id) {
      setSelectedCollectionId(null);
    }

    markCollectionForDelete(collection.id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          <div className="flex flex-col" style={{ gap: 2 }}>
            {tree.map((node) => (
              <CollectionTreeRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                expandAll={isSearching}
                toggleExpanded={toggleExpanded}
                selectedCollectionId={selectedCollectionId}
                onSelectCollection={setSelectedCollectionId}
                onDeleteCollection={handleDeleteCollection}
                isPendingDelete={isPendingDelete}
              />
            ))}
          </div>
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
          rootPath={workspace.rootPath}
          existingPaths={collections.map((collection) => collection.path)}
          onCreated={() => {
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
