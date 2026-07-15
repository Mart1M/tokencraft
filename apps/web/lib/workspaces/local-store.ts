"use client";

import type { LocalWorkspace } from "@tokencraft/core";

import { normalizeWorkspaceSlug } from "@/lib/workspaces/slug";

const STORAGE_KEY = "tokencraft:workspaces";
const LAST_OPENED_KEY = "tokencraft:last-opened-workspace-id";

function readAll(): LocalWorkspace[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LocalWorkspace[]) : [];
  } catch {
    return [];
  }
}

function writeAll(workspaces: LocalWorkspace[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function generateUniqueSlug(workspaces: LocalWorkspace[], value: string) {
  const base = normalizeWorkspaceSlug(value);
  let candidate = base;
  let suffix = 2;

  while (workspaces.some((workspace) => workspace.slug === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function listWorkspaces(): LocalWorkspace[] {
  return readAll().sort((left, right) => left.name.localeCompare(right.name));
}

export function getWorkspace(idOrSlug: string): LocalWorkspace | null {
  return (
    readAll().find(
      (workspace) => workspace.id === idOrSlug || workspace.slug === idOrSlug
    ) ?? null
  );
}

function getWorkspaceByRootPath(rootPath: string): LocalWorkspace | null {
  return readAll().find((workspace) => workspace.rootPath === rootPath) ?? null;
}

export function createWorkspace(input: { name?: string; rootPath: string }): LocalWorkspace {
  const existing = getWorkspaceByRootPath(input.rootPath);

  if (existing) {
    return existing;
  }

  const workspaces = readAll();
  const fallbackName = input.rootPath.split("/").filter(Boolean).pop() ?? "Workspace";
  const name = input.name?.trim() || fallbackName;

  const workspace: LocalWorkspace = {
    id: generateId(),
    name,
    slug: generateUniqueSlug(workspaces, name),
    rootPath: input.rootPath,
    createdAt: new Date().toISOString(),
  };

  writeAll([workspace, ...workspaces]);
  return workspace;
}

export function renameWorkspace(id: string, name: string): LocalWorkspace | null {
  const workspaces = readAll();
  const index = workspaces.findIndex((workspace) => workspace.id === id);

  if (index === -1) {
    return null;
  }

  workspaces[index] = { ...workspaces[index], name: name.trim() || workspaces[index].name };
  writeAll(workspaces);
  return workspaces[index];
}

export function removeWorkspace(id: string) {
  writeAll(readAll().filter((workspace) => workspace.id !== id));

  if (getLastOpenedWorkspaceId() === id) {
    clearLastOpenedWorkspaceId();
  }
}

export function getLastOpenedWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LAST_OPENED_KEY);
}

export function setLastOpenedWorkspaceId(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAST_OPENED_KEY, id);
}

export function clearLastOpenedWorkspaceId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LAST_OPENED_KEY);
}
