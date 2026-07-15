"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Folder, Tags } from "lucide-react";

import { useTokenExplorer } from "@/components/token-explorer-provider";
import { cn } from "@/lib/utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";
import {
  buildTokenTree,
  getTokenGroupSegments,
  type TokenTreeNode,
} from "@/lib/tokens/token-tree";

function TreeNode({
  node,
  depth,
  expanded,
  toggleExpanded,
  selectedGroupSegments,
  onSelect,
}: {
  node: TokenTreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  selectedGroupSegments: string[] | null;
  onSelect: (segments: string[]) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const isSelected =
    selectedGroupSegments !== null &&
    selectedGroupSegments.length === node.segments.length &&
    selectedGroupSegments.every(
      (segment, index) => segment === node.segments[index],
    );

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => node.children.length > 0 && toggleExpanded(node.id)}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground",
            node.children.length === 0 && "invisible",
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
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
          onClick={() => onSelect(node.segments)}
          style={{ paddingLeft: depth * 12 + 8 }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1.5 px-2 text-left text-sm transition-colors",
            isSelected
              ? "bg-accent text-foreground"
              : "text-foreground/80 hover:bg-accent",
          )}
        >
          <span className="truncate">{node.label}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {node.tokenCount}
          </span>
        </button>
      </div>
      {isExpanded
        ? node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              selectedGroupSegments={selectedGroupSegments}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}

export function TokenGroupSidebar({ tokens }: { tokens: ImportedTokenRow[] }) {
  const {
    selectedCollectionId,
    selectedGroupSegments,
    setSelectedGroupSegments,
  } = useTokenExplorer();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  if (!selectedCollectionId) {
    return null;
  }

  return (
    <aside className="app-sidebar sticky top-0 z-10 h-screen w-56 shrink-0 overflow-y-auto overflow-x-hidden border-r bg-card">
      <div className="p-3 w-full" style={{ padding: 12 }}>
        <div className="flex flex-col" style={{ gap: 1 }}>
          <button
            type="button"
            onClick={() => setSelectedGroupSegments(null)}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
              selectedGroupSegments === null
                ? "bg-accent text-foreground"
                : "text-foreground/80 hover:bg-accent",
            )}
          >
            <span className="truncate">All tokens</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {collectionTokens.length}
            </span>
          </button>

          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              selectedGroupSegments={selectedGroupSegments}
              onSelect={setSelectedGroupSegments}
            />
          ))}

          {ungroupedCount > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedGroupSegments([])}
              className={cn(
                "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                selectedGroupSegments?.length === 0
                  ? "bg-accent text-foreground"
                  : "text-foreground/80 hover:bg-accent",
              )}
            >
              <span className="truncate text-muted-foreground">Ungrouped</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {ungroupedCount}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
