"use client";

import { create } from "zustand";

import type { TokenDraft } from "@/lib/tokens/draft-utils";
import { getDraftKey } from "@/lib/tokens/draft-utils";

type TokenPanelEditScope = "all" | "single";

type TokenDraftStore = {
  selectedTokenId: string | null;
  isPanelOpen: boolean;
  panelMode: "edit" | "create";
  panelEditScope: TokenPanelEditScope;
  panelFocusMode: string | null;
  createContext: { fileId: string; collectionName: string; sourcePath: string } | null;
  drafts: Record<string, TokenDraft>;
  pendingCollectionDeletes: string[];
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
  clearAllDrafts: () => void;
  renameModeDrafts: (oldMode: string, newMode: string) => void;
  deleteModeDrafts: (mode: string) => void;
  markCollectionForDelete: (fileId: string) => void;
  unmarkCollectionForDelete: (fileId: string) => void;
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

      for (const key of Object.keys(nextDrafts)) {
        if (key === tokenId || key.startsWith(`${tokenId}::`)) {
          delete nextDrafts[key];
        }
      }

      return { drafts: nextDrafts };
    }),
  clearAllDrafts: () =>
    set({
      drafts: {},
      pendingCollectionDeletes: [],
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
  reset: () =>
    set({
      drafts: {},
      pendingCollectionDeletes: [],
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
    );
  },
}));
