"use client";

import { useMemo, useState, type PointerEvent } from "react";

import { useTokenExplorer } from "@/components/token-explorer-provider";
import { TreeView, type TreeDataItem } from "@/components/ui/tree-view";
import { cn } from "@/lib/utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import {
  buildTokenTree,
  getTokenGroupSegments,
  type TokenTreeNode,
} from "@/lib/tokens/token-tree";

export function TokenGroupSidebar({ tokens }: { tokens: ImportedTokenRow[] }) {
  const {
    selectedCollectionId,
    selectedGroupSegments,
    setSelectedGroupSegments,
  } = useTokenExplorer();
  const [sidebarWidth, setSidebarWidth] = useState(224);

  const collectionTokens = useMemo(
    () => tokens.filter((token) => token.fileId === selectedCollectionId),
    [tokens, selectedCollectionId],
  );

  const tree = useMemo(
    () => buildTokenTree(collectionTokens),
    [collectionTokens],
  );

  const ungroupedCount = useMemo(
    () =>
      collectionTokens.filter(
        (token) => getTokenGroupSegments(token.name).length === 0,
      ).length,
    [collectionTokens],
  );

  const treeData = useMemo<TreeDataItem<TokenTreeNode>[]>(
    () =>
      tree.map(function toTreeItem(node): TreeDataItem<TokenTreeNode> {
        return {
          id: node.id,
          name: node.label,
          value: node,
          onClick: () => setSelectedGroupSegments(node.segments),
          ...(node.children.length
            ? { children: node.children.map(toTreeItem) }
            : {}),
        };
      }),
    [tree, setSelectedGroupSegments],
  );

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidth;

    function resize(moveEvent: globalThis.PointerEvent) {
      setSidebarWidth(Math.min(420, Math.max(180, startWidth + moveEvent.clientX - startX)));
    }

    function stopResize() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
  }

  if (!selectedCollectionId) {
    return null;
  }

  return (
    <aside
      className="app-sidebar relative sticky top-0 z-10 h-screen shrink-0 overflow-y-auto overflow-x-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      style={{ width: sidebarWidth }}
    >
      <div className="p-3 w-full" style={{ padding: 12 }}>
        <div className="flex flex-col" style={{ gap: 1 }}>
          <button
            type="button"
            onClick={() => setSelectedGroupSegments(null)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              selectedGroupSegments === null
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70",
            )}
          >
            <span className="truncate">All tokens</span>
            <span className="ml-auto shrink-0 text-xs text-sidebar-foreground/55">
              {collectionTokens.length}
            </span>
          </button>

          <TreeView
            data={treeData}
            selectedItemId={selectedGroupSegments?.join("/")}
            renderItem={({ item }) => (
              <>
                <span className="truncate">{item.name}</span>
                <span className="ml-auto shrink-0 text-xs text-sidebar-foreground/55">
                  {item.value?.tokenCount}
                </span>
              </>
            )}
          />

          {ungroupedCount > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedGroupSegments([])}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                selectedGroupSegments?.length === 0
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70",
              )}
            >
              <span className="truncate text-sidebar-foreground/65">Ungrouped</span>
              <span className="ml-auto shrink-0 text-xs text-sidebar-foreground/55">
                {ungroupedCount}
              </span>
            </button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        aria-label="Resize token type sidebar"
        onPointerDown={startResize}
        className="absolute inset-y-0 right-0 z-20 w-1 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/50 focus-visible:bg-primary/50 focus-visible:outline-none"
      />
    </aside>
  );
}
