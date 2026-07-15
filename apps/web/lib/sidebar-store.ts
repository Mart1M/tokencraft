import { create } from "zustand";

interface SidebarStore {
  createCollectionDialogOpen: boolean;
  setCreateCollectionDialogOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  createCollectionDialogOpen: false,
  setCreateCollectionDialogOpen: (createCollectionDialogOpen) =>
    set({ createCollectionDialogOpen }),
}));
