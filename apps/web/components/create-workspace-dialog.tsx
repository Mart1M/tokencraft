"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { cn } from "@/lib/utils";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: { id: string; name: string; slug: string }) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

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
      setName("");
      setError(null);
      setIsPending(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      setError("Workspace name must be at least 2 characters.");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        redirect: "manual",
        body: JSON.stringify({
          name: trimmedName,
        }),
      });
      const result = await readJsonResponse<{
        workspace?: { id: string; name: string; slug: string };
      }>(response);

      if (result.error || !result.data?.workspace) {
        throw new Error(result.error ?? "Unable to create workspace.");
      }

      onCreated(result.data.workspace);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create workspace."
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,28rem)] -translate-x-1/2 -translate-y-1/2",
        "rounded-xl border bg-background p-0 text-foreground shadow-xl",
        "backdrop:bg-black/50 open:animate-in open:fade-in-0"
      )}
      onClose={() => onOpenChange(false)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Create workspace</h2>
          <p className="text-sm text-muted-foreground">
            Each workspace has its own GitHub connection and token files.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="workspace-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Design system"
            autoFocus
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
