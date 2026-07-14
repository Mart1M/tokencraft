"use client";

import { FolderOpen, Plus, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/lib/sidebar-store";

export function TokensCollectionsEmptyState({
  settingsHref,
}: {
  settingsHref: string;
}) {
  const setCreateCollectionDialogOpen = useSidebarStore(
    (state) => state.setCreateCollectionDialogOpen,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col px-8 pb-8">
      <div className="empty-state-card flex-1">
        <div className="empty-state-icon">
          <FolderOpen size={24} />
        </div>
        <h2 className="text-xl font-semibold text-foreground">No collections yet</h2>
        <p className="empty-state-description">
          Create a JSON token file in your repository, or import existing token files
          from GitHub to start editing.
        </p>
        <div className="empty-state-actions">
          <Button type="button" onClick={() => setCreateCollectionDialogOpen(true)}>
            <Plus size={16} />
            Create collection
          </Button>
          <Button variant="outline" asChild>
            <Link href={settingsHref}>
              <Settings size={16} />
              Import from repository
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
