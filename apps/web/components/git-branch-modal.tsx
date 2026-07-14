"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, GitBranchPlus, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BranchPayload = {
  branches: string[];
  currentBranch: string;
  defaultBranch: string;
};

export function GitBranchModal({
  open,
  onOpenChange,
  workspaceId,
  currentBranch,
  onBranchChanged,
  hasLocalChanges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  currentBranch: string;
  onBranchChanged: (branch: string) => void;
  hasLocalChanges?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [query, setQuery] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiBase = `/api/workspaces/${encodeURIComponent(workspaceId)}/repositories/branches`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadBranches() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(apiBase, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as BranchPayload & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load branches.");
        }

        if (!cancelled) {
          setBranches(payload.branches);
          setDefaultBranch(payload.defaultBranch);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load branches."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBranches();

    return () => {
      cancelled = true;
    };
  }, [apiBase, open]);

  const filteredBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return branches;
    }

    return branches.filter((branch) => branch.toLowerCase().includes(normalizedQuery));
  }, [branches, query]);

  async function runBranchAction(body: Record<string, string | undefined>) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(apiBase, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        branch?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Branch action failed.");
      }

      if (payload.branch) {
        onBranchChanged(payload.branch);
      }

      onOpenChange(false);
      setNewBranchName("");
      setQuery("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Branch action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchBranch(branch: string) {
    if (branch === currentBranch || isSubmitting) {
      return;
    }

    if (hasLocalChanges) {
      const confirmed = window.confirm(
        "You have uncommitted token changes. Switching branches will discard them. Continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    void runBranchAction({ action: "switch", branch });
  }

  function createBranch(event: React.FormEvent) {
    event.preventDefault();

    if (!newBranchName.trim() || isSubmitting) {
      return;
    }

    if (hasLocalChanges) {
      const confirmed = window.confirm(
        "You have uncommitted token changes. Creating a branch will discard them. Continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    void runBranchAction({
      action: "create",
      name: newBranchName.trim(),
      fromBranch: currentBranch,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,32rem)] -translate-x-1/2 -translate-y-1/2",
        "rounded-xl border bg-background p-0 text-foreground shadow-xl",
        "backdrop:bg-black/50 open:animate-in open:fade-in-0"
      )}
      onClose={() => onOpenChange(false)}
    >
      <div className="flex max-h-[min(80vh,36rem)] flex-col gap-4 p-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Switch branch</h2>
          <p className="text-sm text-muted-foreground">
            Choose an existing branch or create a new one from{" "}
            <span className="font-mono">{currentBranch}</span>.
          </p>
        </div>

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search branches"
            className="pl-9"
            disabled={isLoading || isSubmitting}
          />
        </div>

        <div className="min-h-40 overflow-y-auto rounded-lg border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              Loading branches...
            </div>
          ) : filteredBranches.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No branches found.</p>
          ) : (
            <ul className="divide-y">
              {filteredBranches.map((branch) => {
                const isCurrent = branch === currentBranch;
                const isDefault = branch === defaultBranch;

                return (
                  <li key={branch}>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => switchBranch(branch)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                        "hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
                        isCurrent && "bg-accent/60"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono">{branch}</span>
                        {isDefault ? (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            default
                          </span>
                        ) : null}
                      </span>
                      {isCurrent ? <Check size={16} className="shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form className="space-y-3 border-t pt-4" onSubmit={createBranch}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-branch-name">
              Create branch
            </label>
            <Input
              id="new-branch-name"
              value={newBranchName}
              onChange={(event) => setNewBranchName(event.target.value)}
              placeholder="feature/update-tokens"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !newBranchName.trim()}>
              <GitBranchPlus size={16} />
              Create branch
            </Button>
          </div>
        </form>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </dialog>
  );
}
