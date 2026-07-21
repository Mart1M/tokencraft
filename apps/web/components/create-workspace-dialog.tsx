"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWorkspace } from "@/lib/workspaces/local-store";
import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";
import { cn } from "@/lib/utils";

import type { LocalWorkspace, ModeStorage } from "@tokencraft/core";

const MODE_STORAGE_OPTIONS: Array<{
  value: ModeStorage;
  title: string;
  description: string;
}> = [
  {
    value: "value-map",
    title: "Same file ($value map)",
    description:
      "Modes live in one JSON file as keys under $value / value (e.g. light and dark side by side).",
  },
  {
    value: "separate-files",
    title: "Separate files",
    description:
      "Each mode is its own token file. A collection lists one file per mode in tokencraft.config.json.",
  },
];

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspace: LocalWorkspace) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [modeStorage, setModeStorage] = useState<ModeStorage>("value-map");
  const [error, setError] = useState<string | null>(null);
  const [isBrowsing, setIsBrowsing] = useState(false);
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
      setRootPath("");
      setModeStorage("value-map");
      setError(null);
      setIsBrowsing(false);
      setIsPending(false);
    }
  }, [open]);

  async function handleBrowse() {
    setError(null);
    setIsBrowsing(true);

    try {
      const response = await fetch("/api/workspaces/browse-native", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { path?: string | null };

      if (payload.path) {
        setRootPath(payload.path);

        if (!name.trim()) {
          setName(payload.path.split("/").filter(Boolean).pop() ?? "");
        }
      }
    } catch {
      setError("Could not open the native folder picker on this machine.");
    } finally {
      setIsBrowsing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!rootPath.trim()) {
      setError("Choose a folder for this workspace.");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const initResponse = await fetch("/api/workspaces/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootPath: rootPath.trim(),
          modeStorage,
        }),
      });

      if (!initResponse.ok) {
        const payload = await initResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "That folder could not be initialized.");
      }

      const response = await fetch(
        `/api/workspaces/tokens?root=${encodeURIComponent(rootPath.trim())}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "That folder could not be opened.");
      }

      const workspace = createWorkspace({ name: name.trim(), rootPath: rootPath.trim() });
      onCreated(workspace);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to open this folder."
      );
    } finally {
      setIsPending(false);
    }
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
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Open a local project</h2>
          <p className="text-sm text-muted-foreground">
            Pick a folder on this computer. TokenCraft will auto-detect its design
            token files.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="workspace-path" className="text-sm font-medium">
            Folder
          </label>
          <div className="flex gap-2">
            <Input
              id="workspace-path"
              value={rootPath}
              onChange={(event) => setRootPath(sanitizeFolderPathInput(event.target.value))}
              placeholder="/path/to/your/project"
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={handleBrowse}
              disabled={isBrowsing}
            >
              <FolderOpen size={16} />
              {isBrowsing ? "Waiting…" : "Browse…"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="workspace-name" className="text-sm font-medium">
            Workspace name
          </label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Design system"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Mode storage</legend>
          <p className="text-sm text-muted-foreground">
            How modes are stored on disk. Applied when this folder has no
            tokencraft.config.json yet; an existing config keeps its setting.
          </p>
          <div className="space-y-2">
            {MODE_STORAGE_OPTIONS.map((option) => {
              const selected = modeStorage === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    selected
                      ? "border-foreground/30 bg-muted/60"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="mode-storage"
                    value={option.value}
                    checked={selected}
                    onChange={() => setModeStorage(option.value)}
                    className="mt-1"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

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
          <Button type="submit" disabled={isPending || !rootPath.trim()}>
            {isPending ? "Opening…" : "Open workspace"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
