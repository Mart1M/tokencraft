"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tree view API adapted from mrlightful/shadcn-tree-view (MIT) for TokenCraft.
 * It keeps the library's data/rendering model while allowing the app to own
 * selection and the visual treatment of each item.
 */
export type TreeDataItem<T = unknown> = {
  id: string;
  name: string;
  children?: TreeDataItem<T>[];
  value?: T;
  actions?: React.ReactNode;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  title?: string;
};

export type TreeRenderItemParams<T = unknown> = {
  item: TreeDataItem<T>;
  level: number;
  isLeaf: boolean;
  isSelected: boolean;
  isOpen: boolean;
  hasChildren: boolean;
};

type TreeViewProps<T> = {
  data: TreeDataItem<T>[];
  selectedItemId?: string;
  onSelectChange?: (item: TreeDataItem<T> | undefined) => void;
  expandAll?: boolean;
  className?: string;
  renderItem?: (params: TreeRenderItemParams<T>) => React.ReactNode;
};

function collectAncestorIds<T>(
  items: TreeDataItem<T>[],
  targetId: string,
  ancestors: string[] = [],
): string[] | null {
  for (const item of items) {
    if (item.id === targetId) {
      return ancestors;
    }

    const result = item.children?.length
      ? collectAncestorIds(item.children, targetId, [...ancestors, item.id])
      : null;

    if (result) {
      return result;
    }
  }

  return null;
}

function TreeItem<T>({
  item,
  level,
  expandedIds,
  toggleExpanded,
  selectedItemId,
  onSelect,
  expandAll,
  renderItem,
}: {
  item: TreeDataItem<T>;
  level: number;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  selectedItemId?: string;
  onSelect: (item: TreeDataItem<T>) => void;
  expandAll: boolean;
  renderItem?: (params: TreeRenderItemParams<T>) => React.ReactNode;
}) {
  const hasChildren = Boolean(item.children?.length);
  const isOpen = expandAll || expandedIds.has(item.id);
  const isSelected = selectedItemId === item.id;
  const params: TreeRenderItemParams<T> = {
    item,
    level,
    isLeaf: !hasChildren,
    isSelected,
    isOpen,
    hasChildren,
  };

  function handleItemClick() {
    if (item.onClick) {
      onSelect(item);
      return;
    }

    if (hasChildren) {
      toggleExpanded(item.id);
    }
  }

  return (
    <li>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={isSelected}
        className="group flex min-w-0 items-center gap-1"
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded(item.id);
            }}
            aria-label={isOpen ? "Collapse" : "Expand"}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-150",
                isOpen && "rotate-90",
              )}
            />
          </button>
        ) : null}
        <button
          type="button"
          title={item.title ?? item.name}
          onClick={handleItemClick}
          onContextMenu={item.onContextMenu}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
            isSelected
              ? "bg-accent text-foreground"
              : "text-foreground/80 hover:bg-accent",
            item.className,
          )}
        >
          {renderItem ? renderItem(params) : <span className="truncate">{item.name}</span>}
        </button>
        {item.actions ? <div className="shrink-0">{item.actions}</div> : null}
      </div>
      {hasChildren && isOpen ? (
        <ul role="group" className="ml-4 border-l border-border/70 pl-4">
          {item.children?.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              selectedItemId={selectedItemId}
              onSelect={onSelect}
              expandAll={expandAll}
              renderItem={renderItem}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TreeView<T>({
  data,
  selectedItemId,
  onSelectChange,
  expandAll = false,
  className,
  renderItem,
}: TreeViewProps<T>) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // User collapses win over auto-expanding ancestors of the selection.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const selectedAncestors = useMemo(
    () => (selectedItemId ? collectAncestorIds(data, selectedItemId) : null),
    [data, selectedItemId],
  );

  useEffect(() => {
    setCollapsedIds(new Set());
  }, [selectedItemId]);

  const visibleExpandedIds = useMemo(() => {
    const next = new Set([...expandedIds, ...(selectedAncestors ?? [])]);
    for (const id of collapsedIds) {
      next.delete(id);
    }
    return next;
  }, [expandedIds, selectedAncestors, collapsedIds]);

  function toggleExpanded(id: string) {
    const isOpen = visibleExpandedIds.has(id);

    if (isOpen) {
      setCollapsedIds((current) => new Set(current).add(id));
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }

    setCollapsedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setExpandedIds((current) => new Set(current).add(id));
  }

  return (
    <ul role="tree" className={cn("space-y-px", className)}>
      {data.map((item) => (
        <TreeItem
          key={item.id}
          item={item}
          level={0}
          expandedIds={visibleExpandedIds}
          toggleExpanded={toggleExpanded}
          selectedItemId={selectedItemId}
          onSelect={(selectedItem) => {
            selectedItem.onClick?.();
            onSelectChange?.(selectedItem);
          }}
          expandAll={expandAll}
          renderItem={renderItem}
        />
      ))}
    </ul>
  );
}
