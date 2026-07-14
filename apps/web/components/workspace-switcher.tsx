"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Layers, Plus } from "lucide-react";

import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { cn } from "@/lib/utils";

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
};

function getWorkspaceSlugFromPath(pathname: string) {
  const match = pathname.match(/\/dashboard\/workspaces\/([^/]+)/);
  return match?.[1] ?? null;
}

function getWorkspaceDestination(pathname: string, slug: string) {
  if (pathname.includes("/settings")) {
    return `/dashboard/workspaces/${encodeURIComponent(slug)}/settings`;
  }

  if (pathname.includes("/tokens")) {
    return `/dashboard/workspaces/${encodeURIComponent(slug)}/tokens`;
  }

  return `/dashboard/workspaces/${encodeURIComponent(slug)}/tokens`;
}

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentSlug = getWorkspaceSlugFromPath(pathname);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.slug === currentSlug) ?? workspaces[0],
    [currentSlug, workspaces]
  );

  async function loadWorkspaces() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/workspaces", {
        credentials: "same-origin",
        cache: "no-store",
        redirect: "manual",
      });
      const result = await readJsonResponse<{ workspaces?: WorkspaceSummary[] }>(response);

      if (result.data?.workspaces) {
        setWorkspaces(result.data.workspaces);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function switchWorkspace(slug: string) {
    router.push(getWorkspaceDestination(pathname, slug));
    setOpen(false);
  }

  function handleWorkspaceCreated(workspace: WorkspaceSummary) {
    setWorkspaces((current) => [workspace, ...current]);
    router.push(`/dashboard/workspaces/${encodeURIComponent(workspace.slug)}/settings`);
  }

  const label = currentWorkspace?.name ?? "Workspace";

  return (
    <>
      <div
        ref={menuRef}
        className={cn("relative px-3 pb-2 pt-3", open && "z-50")}
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-auto w-full justify-start gap-2 px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? label : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          <Layers className="h-4 w-4 shrink-0" />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                {isLoading ? "Loading…" : label}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
            </>
          ) : null}
        </Button>

        {open ? (
          <div
            className={cn(
              "absolute z-50 mt-1 min-w-[14rem] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",
              collapsed ? "left-full top-0 ml-2" : "inset-x-3"
            )}
          >
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Workspaces
            </div>

            {workspaces.length ? (
              workspaces.map((workspace) => {
                const isActive = workspace.slug === currentWorkspace?.slug;

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => switchWorkspace(workspace.slug)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                      isActive && "bg-accent"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    {isActive ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {isLoading ? "Loading…" : "No workspaces yet."}
              </p>
            )}

            <div className="my-1 h-px bg-border" />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Create workspace
            </button>
          </div>
        ) : null}
      </div>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleWorkspaceCreated}
      />
    </>
  );
}
