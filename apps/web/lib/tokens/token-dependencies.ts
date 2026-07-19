import {
  applyDraftToRow,
  getDraftsForToken,
  type TokenDraft,
} from "@/lib/tokens/draft-utils";
import { resolveModeKey, type TokenDisplayValue } from "@/lib/tokens/display";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

// Keep this in sync with the display alias matcher: JSON composite values use
// braces too, but only path-shaped values are token references.
const REFERENCE_PATTERN = /\{([\w./-]+)\}/g;

export type TokenDependency = {
  path: string;
  token?: ImportedTokenRow;
  mode: string | null;
  missing: boolean;
};

export type TokenDependencyGraph = {
  outgoing: TokenDependency[];
  incoming: TokenDependency[];
  cycle: string[] | null;
};

export function extractTokenReferences(value: unknown): string[] {
  const references = new Set<string>();

  function read(current: unknown) {
    if (typeof current === "string") {
      for (const match of current.matchAll(REFERENCE_PATTERN)) {
        const path = match[1]?.trim();
        if (path) references.add(path);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(read);
      return;
    }

    if (current && typeof current === "object") {
      Object.values(current as Record<string, unknown>).forEach(read);
    }
  }

  read(value);
  return [...references];
}

function referencesFromDisplay(display?: TokenDisplayValue) {
  if (!display) return [];
  return extractTokenReferences([
    display.text,
    ...(display.parts?.map((part) => part.text) ?? []),
  ]);
}

function referencesForMode(row: ImportedTokenRow, mode: string | null) {
  const references = new Set<string>();
  const modeKey = mode && row.modes ? resolveModeKey(row.modes, mode) : null;
  const display = modeKey && row.modes
    ? row.modes[modeKey]
    : row.display ?? row.modes?.Default ?? row.modes?.default;

  referencesFromDisplay(display).forEach((path) => references.add(path));
  extractTokenReferences(row.colorModifier).forEach((path) => references.add(path));
  if (!display) {
    extractTokenReferences(row.raw).forEach((path) => references.add(path));
    extractTokenReferences(row.value).forEach((path) => references.add(path));
  }

  return [...references];
}

export function getEffectiveDependencyRows(
  tokens: ImportedTokenRow[],
  drafts: Record<string, TokenDraft>,
) {
  return tokens
    .map((token) => {
      const tokenDrafts = getDraftsForToken(drafts, token.id);
      if (tokenDrafts.some((draft) => draft.operation === "delete")) return null;
      return tokenDrafts.reduce(applyDraftToRow, token);
    })
    .filter((token): token is ImportedTokenRow => Boolean(token));
}

function resolveReference(
  path: string,
  source: ImportedTokenRow,
  rows: ImportedTokenRow[],
) {
  const candidates = rows.filter((row) => row.name === path);
  return (
    candidates.find((candidate) => candidate.fileId === source.fileId) ??
    candidates[0]
  );
}

function buildOutgoing(
  source: ImportedTokenRow,
  rows: ImportedTokenRow[],
  mode: string | null,
) {
  return referencesForMode(source, mode).map((path) => {
    const token = resolveReference(path, source, rows);
    return {
      path,
      token,
      // The mode belongs to the token that contains the reference, not the
      // referenced token. A reference authored in Dark must remain labelled
      // Dark even if its target has no corresponding Dark override.
      mode: mode ?? "Default",
      missing: !token,
    } satisfies TokenDependency;
  });
}

function getReferenceModes(row: ImportedTokenRow) {
  const modes = Object.keys(row.modes ?? {});
  return modes.length ? modes : ["Default"];
}

function buildOutgoingAcrossModes(source: ImportedTokenRow, rows: ImportedTokenRow[]) {
  const dependencies = getReferenceModes(source).flatMap((mode) =>
    buildOutgoing(source, rows, mode === "Default" ? null : mode),
  );
  const seen = new Set<string>();
  return dependencies.filter((dependency) => {
    const key = `${dependency.path}:${dependency.token?.id ?? "missing"}:${dependency.mode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findCycle(
  source: ImportedTokenRow,
  rows: ImportedTokenRow[],
  mode: string | null,
) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(row: ImportedTokenRow): string[] | null {
    const id = row.id;
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      return [...path.slice(start), id];
    }
    if (visited.has(id)) return null;

    visiting.add(id);
    path.push(id);
    for (const dependency of buildOutgoing(row, rows, mode)) {
      if (!dependency.token) continue;
      const cycle = visit(dependency.token);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  return visit(source);
}

export function getTokenDependencyGraph(
  token: ImportedTokenRow,
  tokens: ImportedTokenRow[],
  drafts: Record<string, TokenDraft>,
  mode: string | null,
): TokenDependencyGraph {
  const rows = getEffectiveDependencyRows(tokens, drafts);
  const effectiveToken = rows.find((row) => row.id === token.id) ?? token;
  const outgoing = buildOutgoingAcrossModes(effectiveToken, rows);
  const incoming = rows.flatMap((candidate) =>
    buildOutgoingAcrossModes(candidate, rows)
      .filter((dependency) => dependency.token?.id === effectiveToken.id)
      .map((dependency) => ({
        path: candidate.name,
        token: candidate,
        mode: dependency.mode,
        missing: false,
      })),
  );

  return { outgoing, incoming, cycle: findCycle(effectiveToken, rows, mode) };
}
