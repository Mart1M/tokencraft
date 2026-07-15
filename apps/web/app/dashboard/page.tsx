"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, Plus } from "lucide-react";
import Link from "next/link";

import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import {
  createWorkspace,
  getLastOpenedWorkspaceId,
  listWorkspaces,
} from "@/lib/workspaces/local-store";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";

import type { LocalWorkspace } from "@tokencraft/core";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaces, setWorkspaces] = useState<LocalWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const openPath = searchParams.get("openPath");

    if (openPath) {
      const workspace = createWorkspace({ rootPath: sanitizeFolderPathInput(openPath) });
      router.replace(`/dashboard/workspaces/${encodeURIComponent(workspace.slug)}/tokens`);
      return;
    }

    const all = listWorkspaces();
    const lastOpenedId = getLastOpenedWorkspaceId();
    const lastOpened = lastOpenedId ? all.find((w) => w.id === lastOpenedId) : null;

    if (lastOpened) {
      router.replace(`/dashboard/workspaces/${encodeURIComponent(lastOpened.slug)}/tokens`);
      return;
    }

    setWorkspaces(all);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (isLoading) {
    return null;
  }

  return (
    <DashboardLayout>
      <DashboardPageHeader title="Workspaces" />
      <div className="dashboard-content">
        {workspaces.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <FolderOpen size={24} />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Open your first local project
            </h2>
            <p className="empty-state-description">
              Pick a folder on this computer that contains design token files.
              TokenCraft detects *.tokens.json files automatically.
            </p>
            <div className="empty-state-actions">
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus size={16} />
                Open a project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/dashboard/workspaces/${encodeURIComponent(workspace.slug)}/tokens`}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <h3 className="truncate text-sm font-medium text-foreground">
                  {workspace.name}
                </h3>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {workspace.rootPath}
                </p>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus size={16} />
              Open another project
            </button>
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(workspace) => {
          router.push(`/dashboard/workspaces/${encodeURIComponent(workspace.slug)}/tokens`);
        }}
      />
    </DashboardLayout>
  );
}
