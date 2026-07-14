"use client";

import { create } from "zustand";

import type { TokenDraft } from "@/lib/tokens/draft-utils";

type TokenDraftStore = {
  selectedTokenId: string | null;
  isPanelOpen: boolean;
  panelMode: "edit" | "create";
  createContext: { fileId: string; collectionName: string; sourcePath: string } | null;
  drafts: Record<string, TokenDraft>;
  pendingCollectionDeletes: string[];
  pendingLocalCollectionIds: string[];
  pendingPushFileIds: string[];
  pendingPushCommitCount: number;
  hasRemoteChanges: boolean;
  openToken: (tokenId: string) => void;
  openCreateToken: (context: {
    fileId: string;
    collectionName: string;
    sourcePath: string;
  }) => void;
  closePanel: () => void;
  setDraft: (draft: TokenDraft) => void;
  clearDraft: (tokenId: string) => void;
  clearAllDrafts: () => void;
  clearPendingLocalCollections: () => void;
  markCollectionForDelete: (fileId: string) => void;
  unmarkCollectionForDelete: (fileId: string) => void;
  addPendingLocalCollection: (fileId: string) => void;
  setPendingPushFileIds: (fileIds: string[]) => void;
  incrementPendingPushCommitCount: () => void;
  resetPendingPushCommitCount: () => void;
  resetGitState: () => void;
  setHasRemoteChanges: (value: boolean) => void;
  hasLocalEdits: () => boolean;
};

export const useTokenDraftStore = create<TokenDraftStore>((set, get) => ({
  selectedTokenId: null,
  isPanelOpen: false,
  panelMode: "edit",
  createContext: null,
  drafts: {},
  pendingCollectionDeletes: [],
  pendingLocalCollectionIds: [],
  pendingPushFileIds: [],
  pendingPushCommitCount: 0,
  hasRemoteChanges: false,
  openToken: (tokenId) =>
    set({
      selectedTokenId: tokenId,
      isPanelOpen: true,
      panelMode: "edit",
      createContext: null,
    }),
  openCreateToken: (context) =>
    set({
      selectedTokenId: null,
      isPanelOpen: true,
      panelMode: "create",
      createContext: context,
    }),
  closePanel: () =>
    set({
      isPanelOpen: false,
      panelMode: "edit",
      createContext: null,
    }),
  setDraft: (draft) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [draft.tokenId]: draft,
      },
    })),
  clearDraft: (tokenId) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };
      delete nextDrafts[tokenId];
      return { drafts: nextDrafts };
    }),
  clearAllDrafts: () =>
    set({
      drafts: {},
      pendingCollectionDeletes: [],
    }),
  clearPendingLocalCollections: () => set({ pendingLocalCollectionIds: [] }),
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
  addPendingLocalCollection: (fileId) =>
    set((state) => ({
      pendingLocalCollectionIds: state.pendingLocalCollectionIds.includes(fileId)
        ? state.pendingLocalCollectionIds
        : [...state.pendingLocalCollectionIds, fileId],
    })),
  setPendingPushFileIds: (fileIds) => set({ pendingPushFileIds: fileIds }),
  incrementPendingPushCommitCount: () =>
    set((state) => ({ pendingPushCommitCount: state.pendingPushCommitCount + 1 })),
  resetPendingPushCommitCount: () => set({ pendingPushCommitCount: 0 }),
  resetGitState: () =>
    set({
      drafts: {},
      pendingCollectionDeletes: [],
      pendingLocalCollectionIds: [],
      pendingPushFileIds: [],
      pendingPushCommitCount: 0,
      selectedTokenId: null,
      isPanelOpen: false,
      panelMode: "edit",
      createContext: null,
    }),
  setHasRemoteChanges: (value) => set({ hasRemoteChanges: value }),
  hasLocalEdits: () => {
    const state = get();
    return (
      Object.keys(state.drafts).length > 0 ||
      state.pendingCollectionDeletes.length > 0 ||
      state.pendingLocalCollectionIds.length > 0
    );
  },
}));
