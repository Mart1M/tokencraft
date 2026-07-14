"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FolderOpen,
  Plus,
  Search,
  SidebarIcon,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import {
  isTokenExplorerModeActive,
  useTokenExplorer,
} from "@/components/token-explorer-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RepositoryPathPicker } from "@/components/repository-path-picker";
import { normalizeCollectionPath } from "@/lib/tokens/collection-path";

import type { TokenSidebarCollection } from "@/lib/tokens/entries";

function CreateCollectionDialog({
  open,
  onOpenChange,
  workspaceId,
  existingPaths,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  existingPaths: string[];
  onCreated: (collection: {
    id: string;
    path: string;
    collectionName: string;
  }) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [path, setPath] = useState("tokens/my-set.json");
  const [collectionName, setCollectionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPath("tokens/my-set.json");
      setCollectionName("");
      setError(null);
      setIsPending(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const normalizedPath = normalizeCollectionPath(path);

    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/collections`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: normalizedPath,
            ...(collectionName.trim()
              ? { collectionName: collectionName.trim() }
              : {}),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create collection.");
      }

      onCreated(payload.collection);
      onOpenChange(false);
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
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,32rem)] -translate-x-1/2 -translate-y-1/2",
        "rounded-xl border bg-background p-0 text-foreground shadow-xl",
        "backdrop:bg-black/50 open:animate-in open:fade-in-0",
      )}
      onClose={() => onOpenChange(false)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">New collection</h2>
          <p className="text-sm text-muted-foreground">
            Choose the JSON file path for this collection. It will be created on
            GitHub when you push.
          </p>
        </div>
        {open ? (
          <RepositoryPathPicker
            workspaceId={workspaceId}
            value={path}
            onChange={setPath}
            existingPaths={existingPaths}
          />
        ) : null}
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
          <Button type="submit" disabled={isPending || pathAlreadyUsed || !path.trim()}>
            Create
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function TokensSidebar({
  workspaceId,
  collections = [],
}: {
  workspaceId: string;
  collections?: TokenSidebarCollection[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { collapsed, setCollapsed } = useSidebarStore();
  const {
    activeMode,
    setActiveMode,
    availableModes,
    resolvedMode,
    selectedCollectionId,
    setSelectedCollectionId,
  } = useTokenExplorer();
  const pendingCollectionDeletes = useTokenDraftStore(
    (state) => state.pendingCollectionDeletes,
  );
  const markCollectionForDelete = useTokenDraftStore(
    (state) => state.markCollectionForDelete,
  );
  const unmarkCollectionForDelete = useTokenDraftStore(
    (state) => state.unmarkCollectionForDelete,
  );
  const addPendingLocalCollection = useTokenDraftStore(
    (state) => state.addPendingLocalCollection,
  );
  const setPendingPushFileIds = useTokenDraftStore(
    (state) => state.setPendingPushFileIds,
  );
  const pendingPushFileIds = useTokenDraftStore(
    (state) => state.pendingPushFileIds,
  );
  const incrementPendingPushCommitCount = useTokenDraftStore(
    (state) => state.incrementPendingPushCommitCount,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    selectedCollectionId ? new Set([selectedCollectionId]) : new Set(),
  );
  const showCreateDialog = useSidebarStore((state) => state.createCollectionDialogOpen);
  const setShowCreateDialog = useSidebarStore(
    (state) => state.setCreateCollectionDialogOpen,
  );

  useEffect(() => {
    if (!selectedCollectionId) {
      return;
    }

    setExpanded((current) => {
      if (current.has(selectedCollectionId)) {
        return current;
      }

      return new Set(current).add(selectedCollectionId);
    });
  }, [selectedCollectionId]);

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  };

  const filteredCollections = collections.filter((collection) => {
    if (pendingCollectionDeletes.includes(collection.id)) {
      return true;
    }

    return collection.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  function handleDeleteCollection(collection: TokenSidebarCollection) {
    const confirmed = window.confirm(
      `Delete collection "${collection.name}"? Synced collections are removed from GitHub on push.`,
    );

    if (!confirmed) {
      return;
    }

    if (collection.syncStatus === "LOCAL") {
      startTransition(async () => {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/collections/${encodeURIComponent(collection.id)}`,
          {
            method: "DELETE",
            credentials: "same-origin",
          },
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          window.alert(payload.error ?? "Failed to delete collection.");
          return;
        }

        if (selectedCollectionId === collection.id) {
          setSelectedCollectionId(null);
        }

        router.refresh();
      });
      return;
    }

    if (pendingCollectionDeletes.includes(collection.id)) {
      unmarkCollectionForDelete(collection.id);
      return;
    }

    markCollectionForDelete(collection.id);
  }

  return (
    <aside
      className={cn(
        "app-sidebar sticky top-0 z-20 h-screen w-64 shrink-0 overflow-x-hidden border-r bg-card transition-all duration-300",
      )}
    >
      <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
        <div className="p-3" style={{ padding: 12 }}>
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <SidebarIcon className="h-4 w-4" />
            </Button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-8 w-full min-w-0 pl-8"
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start gap-2"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
            New collection
          </Button>
        </div>

        <div
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3"
          style={{ padding: 12 }}
        >
          {filteredCollections.length > 0 ? (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {filteredCollections.map((collection) => {
                const isExpanded = expanded.has(collection.id);
                const isPendingDelete =
                  collection.pendingDelete ||
                  pendingCollectionDeletes.includes(collection.id);

                return (
                  <div key={collection.id} className="group">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          toggleExpanded(collection.id);
                          setSelectedCollectionId(collection.id);
                        }}
                        className={cn(
                          "box-border flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                          isExpanded
                            ? "text-foreground hover:bg-accent/60"
                            : "text-foreground/80 hover:bg-accent",
                          isPendingDelete && "opacity-60 line-through",
                        )}
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-200",
                            isExpanded && "rotate-90",
                          )}
                        />
                        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{collection.name}</span>
                        {collection.syncStatus === "LOCAL" ? (
                          <Badge
                            variant="secondary"
                            className="ml-auto shrink-0 text-[10px]"
                          >
                            Local
                          </Badge>
                        ) : null}
                        {isPendingDelete ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px]"
                          >
                            deleted
                          </Badge>
                        ) : null}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 opacity-0 group-hover:opacity-100"
                        disabled={isPending}
                        onClick={() => handleDeleteCollection(collection)}
                        aria-label={`Delete ${collection.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    <div
                      className={cn(
                        "ml-6 overflow-hidden border-l pl-2 transition-all duration-200",
                        isExpanded
                          ? "mt-1 max-h-96 opacity-100"
                          : "max-h-0 opacity-0",
                      )}
                    >
                      <div className="flex flex-col" style={{ gap: 6 }}>
                        {collection.modes.map((mode) => {
                          const isActive = isTokenExplorerModeActive(
                            mode,
                            activeMode,
                            resolvedMode,
                            availableModes,
                          );

                          return (
                            <button
                              key={mode}
                              onClick={() => {
                                setSelectedCollectionId(collection.id);
                                setActiveMode(mode === "Default" ? null : mode);
                              }}
                              className={cn(
                                "box-border flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-sm transition-colors hover:bg-accent",
                                selectedCollectionId === collection.id &&
                                  isActive
                                  ? "bg-accent text-foreground"
                                  : isActive
                                    ? "bg-accent/70 text-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <span className="truncate capitalize">
                                {mode}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              No token sets discovered yet.
            </div>
          )}
        </div>
      </div>
      <CreateCollectionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        workspaceId={workspaceId}
        existingPaths={collections.map((collection) => collection.path)}
        onCreated={(collection) => {
          setExpanded((current) => new Set(current).add(collection.id));
          setSelectedCollectionId(collection.id);
          setActiveMode(null);
          addPendingLocalCollection(collection.id);
          setPendingPushFileIds([
            ...new Set([...pendingPushFileIds, collection.id]),
          ]);
          incrementPendingPushCommitCount();
          router.refresh();
        }}
      />
    </aside>
  );
}
