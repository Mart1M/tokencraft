"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceDataProvider, useWorkspaceData } from "@/components/workspace-data-provider";
import { renameWorkspace, removeWorkspace } from "@/lib/workspaces/local-store";
import { tokensPagePath } from "@/lib/workspaces/repository-route-utils";

export default function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);

  return (
    <WorkspaceDataProvider workspaceId={workspaceId}>
      <WorkspaceSettingsContent />
    </WorkspaceDataProvider>
  );
}

function WorkspaceSettingsContent() {
  const router = useRouter();
  const { workspace, data } = useWorkspaceData();
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
    }
  }, [workspace]);

  if (!workspace) {
    return null;
  }

  function handleRename(event: React.FormEvent) {
    event.preventDefault();
    renameWorkspace(workspace!.id, name);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 1500);
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Remove workspace "${workspace!.name}"? This only forgets it here — nothing on disk is deleted.`
    );

    if (!confirmed) {
      return;
    }

    removeWorkspace(workspace!.id);
    router.push("/dashboard");
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-8 py-8">
        <DashboardPageHeader title="Workspace settings" titleClassName="text-2xl font-semibold" />

        <section className="space-y-4">
          <form onSubmit={handleRename} className="space-y-2">
            <label htmlFor="workspace-name" className="text-sm font-medium">
              Name
            </label>
            <div className="flex gap-2">
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" variant="outline">
                {savedName ? "Saved" : "Save"}
              </Button>
            </div>
          </form>

          <div className="space-y-1">
            <span className="text-sm font-medium">Folder</span>
            <p className="rounded-md border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
              {workspace.rootPath}
            </p>
            <p className="text-sm text-muted-foreground">
              TokenCraft looks for <code>**/*.tokens.json</code> here, or the file
              list in a <code>tokencraft.config.json</code> at the workspace root
              if one exists.
            </p>
          </div>
        </section>

        <section className="space-y-3 border-t pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Token files</h2>
            <Link
              href={tokensPagePath(workspace.slug)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Open explorer
            </Link>
          </div>
          {data?.collections.length ? (
            <ul className="divide-y rounded-lg border">
              {data.collections.map((collection) => (
                <li key={collection.id} className="px-3 py-2 text-sm">
                  <p className="text-foreground">{collection.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{collection.path}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No token files detected yet.</p>
          )}
        </section>

        <section className="space-y-3 border-t pt-8">
          <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
          <p className="text-sm text-muted-foreground">
            Removes this workspace from TokenCraft. Files on disk are left untouched.
          </p>
          <Button type="button" variant="outline" className="gap-2" onClick={handleDelete}>
            <Trash2 size={16} />
            Remove workspace
          </Button>
        </section>
      </div>
    </DashboardLayout>
  );
}
