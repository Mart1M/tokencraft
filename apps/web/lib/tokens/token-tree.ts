import type { ImportedTokenRow } from "@/lib/tokens/entries";

export type TokenTreeNode = {
  id: string;
  label: string;
  segments: string[];
  children: TokenTreeNode[];
  tokenCount: number;
};

/** Splits a token path into segments on both "." (nesting) and "-" (kebab-case names). */
export function splitTokenPath(name: string): string[] {
  return name.split(/[.-]+/).filter(Boolean);
}

/** The group segments a token belongs to — every path segment except the leaf token name. */
export function getTokenGroupSegments(name: string): string[] {
  return splitTokenPath(name).slice(0, -1);
}

export function buildTokenTree(tokens: ImportedTokenRow[]): TokenTreeNode[] {
  const root: TokenTreeNode[] = [];

  function insert(nodes: TokenTreeNode[], segments: string[], depth: number, pathSoFar: string[]) {
    if (depth >= segments.length) {
      return;
    }

    const segment = segments[depth];
    const nextPath = [...pathSoFar, segment];
    const id = nextPath.join("/");
    let node = nodes.find((candidate) => candidate.id === id);

    if (!node) {
      node = { id, label: segment, segments: nextPath, children: [], tokenCount: 0 };
      nodes.push(node);
    }

    node.tokenCount += 1;
    insert(node.children, segments, depth + 1, nextPath);
  }

  for (const token of tokens) {
    const groupSegments = getTokenGroupSegments(token.name);

    if (groupSegments.length === 0) {
      continue;
    }

    insert(root, groupSegments, 0, []);
  }

  function sortTree(nodes: TokenTreeNode[]) {
    nodes.sort((left, right) => left.label.localeCompare(right.label));
    nodes.forEach((node) => sortTree(node.children));
  }

  sortTree(root);

  return root;
}

/**
 * Whether a token belongs to the given (non-empty) group path. Selecting "all
 * tokens" or "ungrouped" are handled separately by the caller, since an empty
 * segments array is ambiguous between the two.
 */
export function tokenMatchesGroup(token: ImportedTokenRow, groupSegments: string[]): boolean {
  const tokenSegments = splitTokenPath(token.name);

  if (groupSegments.length > tokenSegments.length) {
    return false;
  }

  return groupSegments.every((segment, index) => tokenSegments[index] === segment);
}
