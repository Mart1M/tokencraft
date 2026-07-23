"use client";

import { create } from "zustand";

import type { TokenDraft } from "@/lib/tokens/draft-utils";
import { getDraftKey } from "@/lib/tokens/draft-utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

type TokenPanelEditScope = "all" | "single";

export type PendingCollectionCreate = {
  id: string;
  path: string;
  collectionName?: string;
};

export type PendingFolderCreate = {
  id: string;
  path: string;
};

export type PendingPathRename = { id: string; oldPath: string; newPath: string };

export type PendingModeChange = {
  id: string;
  fileId: string;
  action: "add" | "rename" | "delete";
  oldMode?: string;
  newMode?: string;
  mode?: string;
  modes: string[];
};

export type PendingFileWrite = {
  path: string;
  content: string;
  fileId: string;
};

type TokenDraftStore = {
  selectedTokenId: string | null;
  isPanelOpen: boolean;
  panelMode: "edit" | "create";
  panelEditScope: TokenPanelEditScope;
  panelFocusMode: string | null;
  createContext: { fileId: string; collectionName: string; sourcePath: string } | null;
  drafts: Record<string, TokenDraft>;
  pendingCollectionDeletes: string[];
  pendingCollectionCreates: Record<string, PendingCollectionCreate>;
  pendingFolderCreates: Record<string, PendingFolderCreate>;
  pendingCollectionRenames: Record<string, PendingPathRename>;
  pendingFolderRenames: Record<string, PendingPathRename>;
  pendingModeChanges: Record<string, PendingModeChange>;
  pendingFileWrites: Record<string, PendingFileWrite>;
  jsonOverrides: Record<string, ImportedTokenRow[]>;
  openToken: (tokenId: string) => void;
  openTokenForMode: (tokenId: string, mode: string) => void;
  openCreateToken: (context: {
    fileId: string;
    collectionName: string;
    sourcePath: string;
  }) => void;
  closePanel: () => void;
  setDraft: (draft: TokenDraft) => void;
  clearDraft: (tokenId: string) => void;
  clearDraftByKey: (key: string) => void;
  clearAllDrafts: () => void;
  renameModeDrafts: (oldMode: string, newMode: string) => void;
  deleteModeDrafts: (mode: string) => void;
  markCollectionForDelete: (fileId: string) => void;
  unmarkCollectionForDelete: (fileId: string) => void;
  stageCollectionCreate: (change: Omit<PendingCollectionCreate, "id">) => void;
  clearCollectionCreate: (id: string) => void;
  stageFolderCreate: (path: string) => void;
  clearFolderCreate: (id: string) => void;
  stageCollectionRename: (oldPath: string, newPath: string) => void;
  stageFolderRename: (oldPath: string, newPath: string) => void;
  clearCollectionRename: (id: string) => void;
  clearFolderRename: (id: string) => void;
  stageModeChange: (change: Omit<PendingModeChange, "id">) => void;
  clearModeChange: (id: string) => void;
  stageJsonDocuments: (input: {
    fileId: string;
    tokens: ImportedTokenRow[];
    documents: Array<{ path: string; content: string }>;
  }) => void;
  clearJsonDocuments: (fileId: string) => void;
  reset: () => void;
  hasLocalEdits: () => boolean;
};

export const useTokenDraftStore = create<TokenDraftStore>((set, get) => ({
  selectedTokenId: null,
  isPanelOpen: false,
  panelMode: "edit",
  panelEditScope: "all",
  panelFocusMode: null,
  createContext: null,
  drafts: {},
  pendingCollectionDeletes: [],
  pendingCollectionCreates: {},
  pendingFolderCreates: {},
  pendingCollectionRenames: {},
  pendingFolderRenames: {},
  pendingModeChanges: {},
  pendingFileWrites: {},
  jsonOverrides: {},
  openToken: (tokenId) =>
    set({
      selectedTokenId: tokenId,
      isPanelOpen: true,
      panelMode: "edit",
      panelEditScope: "all",
      panelFocusMode: null,
      createContext: null,
    }),
  openTokenForMode: (tokenId, mode) =>
    set({
      selectedTokenId: tokenId,
      isPanelOpen: true,
      panelMode: "edit",
      panelEditScope: "single",
      panelFocusMode: mode,
      createContext: null,
    }),
  openCreateToken: (context) =>
    set({
      selectedTokenId: null,
      isPanelOpen: true,
      panelMode: "create",
      panelEditScope: "all",
      panelFocusMode: null,
      createContext: context,
    }),
  closePanel: () =>
    set({
      isPanelOpen: false,
      panelMode: "edit",
      panelEditScope: "all",
      panelFocusMode: null,
      createContext: null,
    }),
  setDraft: (draft) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [getDraftKey(draft)]: draft,
      },
    })),
  clearDraft: (tokenId) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };
      const removedDrafts = Object.values(nextDrafts).filter(
        (draft) => draft.tokenId === tokenId,
      );

      for (const key of Object.keys(nextDrafts)) {
        if (key === tokenId || key.startsWith(`${tokenId}::`)) {
          delete nextDrafts[key];
        }
      }

      const discardedCreatedToken =
        state.selectedTokenId === tokenId &&
        removedDrafts.some((draft) => draft.operation === "create");

      return {
        drafts: nextDrafts,
        ...(discardedCreatedToken
          ? { selectedTokenId: null, isPanelOpen: false }
          : {}),
      };
    }),
  clearDraftByKey: (key) =>
    set((state) => {
      const drafts = { ...state.drafts };
      const removedDraft = drafts[key];
      delete drafts[key];
      const discardedCreatedToken =
        removedDraft?.operation === "create" &&
        state.selectedTokenId === removedDraft.tokenId &&
        !Object.values(drafts).some(
          (draft) => draft.tokenId === removedDraft.tokenId && draft.operation === "create",
        );

      return {
        drafts,
        ...(discardedCreatedToken
          ? { selectedTokenId: null, isPanelOpen: false }
          : {}),
      };
    }),
  clearAllDrafts: () =>
    set((state) => {
      const discardedSelectedCreatedToken = Object.values(state.drafts).some(
        (draft) =>
          draft.tokenId === state.selectedTokenId && draft.operation === "create",
      );

      return {
        drafts: {},
        pendingCollectionDeletes: [],
        pendingCollectionCreates: {},
        pendingFolderCreates: {},
        pendingCollectionRenames: {},
        pendingFolderRenames: {},
        pendingModeChanges: {},
        pendingFileWrites: {},
        jsonOverrides: {},
        ...(discardedSelectedCreatedToken
          ? { selectedTokenId: null, isPanelOpen: false }
          : {}),
      };
    }),
  renameModeDrafts: (oldMode, newMode) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };

      for (const [key, draft] of Object.entries(nextDrafts)) {
        if (draft.mode !== oldMode) {
          continue;
        }

        const updatedDraft = { ...draft, mode: newMode };
        const nextKey = getDraftKey(updatedDraft);

        delete nextDrafts[key];
        nextDrafts[nextKey] = updatedDraft;
      }

      return {
        drafts: nextDrafts,
        panelFocusMode:
          state.panelFocusMode === oldMode ? newMode : state.panelFocusMode,
      };
    }),
  deleteModeDrafts: (mode) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };

      for (const [key, draft] of Object.entries(nextDrafts)) {
        if (draft.mode === mode) {
          delete nextDrafts[key];
        }
      }

      return {
        drafts: nextDrafts,
        panelFocusMode: state.panelFocusMode === mode ? null : state.panelFocusMode,
      };
    }),
  markCollectionForDelete: (fileId) =>
    set((state) => ({
      pendingCollectionDeletes: state.pendingCollectionDeletes.includes(fileId)
        ? state.pendingCollectionDeletes
        : [...state.pendingCollectionDeletes, fileId],
    })),
  unmarkCollectionForDelete: (fileId) =>
    set((state) => ({
      pendingCollectionDeletes: state.pendingCollectionDeletes.filter((id) => id !== fileId),
    })),
  stageCollectionCreate: (change) => {
    const id = `create:${change.path}`;
    set((state) => ({
      pendingCollectionCreates: {
        ...state.pendingCollectionCreates,
        [id]: { ...change, id },
      },
    }));
  },
  clearCollectionCreate: (id) =>
    set((state) => {
      const pendingCollectionCreates = { ...state.pendingCollectionCreates };
      delete pendingCollectionCreates[id];
      return { pendingCollectionCreates };
    }),
  stageFolderCreate: (path) => {
    const id = `folder:${path}`;
    set((state) => ({
      pendingFolderCreates: {
        ...state.pendingFolderCreates,
        [id]: { id, path },
      },
    }));
  },
  clearFolderCreate: (id) =>
    set((state) => {
      const pendingFolderCreates = { ...state.pendingFolderCreates };
      delete pendingFolderCreates[id];
      return { pendingFolderCreates };
    }),
  stageCollectionRename: (oldPath, newPath) => set((state) => {
    const id = `rename:collection:${oldPath}`;
    return { pendingCollectionRenames: { ...state.pendingCollectionRenames, [id]: { id, oldPath, newPath } } };
  }),
  stageFolderRename: (oldPath, newPath) => set((state) => {
    const id = `rename:folder:${oldPath}`;
    return { pendingFolderRenames: { ...state.pendingFolderRenames, [id]: { id, oldPath, newPath } } };
  }),
  clearCollectionRename: (id) => set((state) => {
    const pendingCollectionRenames = { ...state.pendingCollectionRenames };
    delete pendingCollectionRenames[id];
    return { pendingCollectionRenames };
  }),
  clearFolderRename: (id) => set((state) => {
    const pendingFolderRenames = { ...state.pendingFolderRenames };
    delete pendingFolderRenames[id];
    return { pendingFolderRenames };
  }),
  stageModeChange: (change) => {
    const id = `${change.fileId}:${change.action}:${change.oldMode ?? change.mode ?? change.newMode}`;
    set((state) => ({
      pendingModeChanges: {
        ...state.pendingModeChanges,
        [id]: { ...change, id },
      },
    }));
  },
  clearModeChange: (id) =>
    set((state) => {
      const pendingModeChanges = { ...state.pendingModeChanges };
      delete pendingModeChanges[id];
      return { pendingModeChanges };
    }),
  stageJsonDocuments: ({ fileId, tokens, documents }) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };
      for (const [key, draft] of Object.entries(nextDrafts)) {
        if (draft.fileId === fileId) {
          delete nextDrafts[key];
        }
      }

      const pendingFileWrites = { ...state.pendingFileWrites };
      for (const [path, write] of Object.entries(pendingFileWrites)) {
        if (write.fileId === fileId) {
          delete pendingFileWrites[path];
        }
      }
      for (const document of documents) {
        pendingFileWrites[document.path] = {
          path: document.path,
          content: document.content,
          fileId,
        };
      }

      return {
        drafts: nextDrafts,
        pendingFileWrites,
        jsonOverrides: {
          ...state.jsonOverrides,
          [fileId]: tokens,
        },
      };
    }),
  clearJsonDocuments: (fileId) =>
    set((state) => {
      const pendingFileWrites = { ...state.pendingFileWrites };
      for (const [path, write] of Object.entries(pendingFileWrites)) {
        if (write.fileId === fileId) {
          delete pendingFileWrites[path];
        }
      }
      const jsonOverrides = { ...state.jsonOverrides };
      delete jsonOverrides[fileId];
      return { pendingFileWrites, jsonOverrides };
    }),
  reset: () =>
    set({
      drafts: {},
      pendingCollectionDeletes: [],
      pendingCollectionCreates: {},
      pendingFolderCreates: {},
      pendingCollectionRenames: {},
      pendingFolderRenames: {},
      pendingModeChanges: {},
      pendingFileWrites: {},
      jsonOverrides: {},
      selectedTokenId: null,
      isPanelOpen: false,
      panelMode: "edit",
      panelEditScope: "all",
      panelFocusMode: null,
      createContext: null,
    }),
  hasLocalEdits: () => {
    const state = get();
    return (
      Object.keys(state.drafts).length > 0 || state.pendingCollectionDeletes.length > 0
      || Object.keys(state.pendingCollectionCreates).length > 0
      || Object.keys(state.pendingFolderCreates).length > 0
      || Object.keys(state.pendingCollectionRenames).length > 0
      || Object.keys(state.pendingFolderRenames).length > 0
      || Object.keys(state.pendingModeChanges).length > 0
      || Object.keys(state.pendingFileWrites).length > 0
    );
  },
}));
