import type { TokenSidebarCollection } from "@/lib/tokens/entries";

export type CollectionTreeNode = {
  id: string;
  label: string;
  children: CollectionTreeNode[];
  /** Present on leaf nodes only — a folder node never carries a collection. */
  collection?: TokenSidebarCollection;
};

function humanizeSegment(segment: string): string {
  const cleaned = segment
    .replace(/\.tokens?\.json$/i, "")
    .replace(/\.json$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || segment;
}

function pathFolderSegments(path: string): string[] {
  return path.split("/").filter(Boolean).slice(0, -1);
}

/** Folder ids (ancestors, root-to-leaf) that contain the given collection path. */
export function getCollectionAncestorIds(path: string): string[] {
  const ids: string[] = [];
  let idPath = "";

  for (const segment of pathFolderSegments(path)) {
    idPath = idPath ? `${idPath}/${segment}` : segment;
    ids.push(idPath);
  }

  return ids;
}

/**
 * Builds a tree that mirrors the on-disk folder structure of a workspace's
 * token files, since each collection is a single file — folders become
 * expandable groups, and files become the leaf collections themselves.
 */
export function buildCollectionTree(
  collections: TokenSidebarCollection[]
): CollectionTreeNode[] {
  const root: CollectionTreeNode[] = [];

  for (const collection of collections) {
    const rawSegments = collection.path.split("/").filter(Boolean);
    const folderSegments = rawSegments.slice(0, -1);
    const fileSegment = rawSegments.at(-1) ?? collection.path;

    let nodes = root;
    let idPath = "";

    for (const segment of folderSegments) {
      idPath = idPath ? `${idPath}/${segment}` : segment;
      let node = nodes.find(
        (candidate) => candidate.id === idPath && !candidate.collection
      );

      if (!node) {
        node = { id: idPath, label: humanizeSegment(segment), children: [] };
        nodes.push(node);
      }

      nodes = node.children;
    }

    nodes.push({
      id: collection.id,
      label: humanizeSegment(fileSegment),
      children: [],
      collection,
    });
  }

  function sortNodes(nodes: CollectionTreeNode[]) {
    nodes.sort((left, right) => {
      const leftIsFolder = !left.collection;
      const rightIsFolder = !right.collection;

      if (leftIsFolder !== rightIsFolder) {
        return leftIsFolder ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    });

    nodes.forEach((node) => sortNodes(node.children));
  }

  sortNodes(root);

  return root;
}
