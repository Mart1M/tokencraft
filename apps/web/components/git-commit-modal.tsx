"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function GitCommitModal({
  open,
  onOpenChange,
  message,
  onMessageChange,
  onConfirm,
  isPending,
  editCount,
  title = "Commit changes",
  description,
  confirmLabel = "Commit",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onMessageChange: (message: string) => void;
  onConfirm: () => void;
  isPending?: boolean;
  editCount?: number;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (message.trim()) {
            onConfirm();
          }
        }}
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {description ??
              (typeof editCount === "number"
                ? `${editCount} token change${editCount === 1 ? "" : "s"} will be saved locally.`
                : "Enter a commit message for your token changes.")}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="commit-message">
            Commit message
          </label>
          <Input
            id="commit-message"
            autoFocus
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Update design tokens"
            disabled={isPending}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || !message.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
