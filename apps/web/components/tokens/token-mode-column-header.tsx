"use client";

import { useCallback, useMemo, useState } from "react";
import { PencilIcon, Plus, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

function AddModeControl({ onAdd }: { onAdd: (mode: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [value, setValue] = useState("");

  function cancel() {
    setIsAdding(false);
    setValue("");
  }

  function confirm() {
    const trimmed = value.trim();

    if (trimmed) {
      onAdd(trimmed);
    }

    cancel();
  }

  if (!isAdding) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 gap-1 px-2 text-muted-foreground"
        onClick={(event) => {
          event.stopPropagation();
          setIsAdding(true);
        }}
      >
        <Plus size={14} />
        Add mode
      </Button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <Input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={confirm}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        placeholder="Mode name"
        className="h-7 w-28 text-xs"
      />
    </form>
  );
}

function ModeHeaderContextMenu({
  mode,
  canDelete,
  onRename,
  onDelete,
}: {
  mode: string;
  canDelete: boolean;
  onRename: (mode: string, newName: string) => Promise<boolean>;
  onDelete: (mode: string) => Promise<boolean>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(mode);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const triggerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: "1px",
      height: "1px",
      padding: 0,
      margin: 0,
      border: "none",
      background: "transparent",
      pointerEvents: "none",
      opacity: 0,
    }),
    [position.x, position.y]
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setPosition({ x: event.clientX, y: event.clientY });
      setMenuOpen(true);
    },
    []
  );

  const openRenameDialog = useCallback(() => {
    setRenameValue(mode);
    setRenameOpen(true);
  }, [mode]);

  const submitRename = useCallback(async () => {
    const success = await onRename(mode, renameValue);

    if (success) {
      setRenameOpen(false);
    }
  }, [mode, onRename, renameValue]);

  const handleDelete = useCallback(async () => {
    await onDelete(mode);
  }, [mode, onDelete]);

  return (
    <>
      <span
        onContextMenu={handleContextMenu}
        className="cursor-default truncate capitalize"
      >
        {mode}
      </span>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger style={triggerStyle} />
        <DropdownMenuContent
          data-grid-popover=""
          align="start"
          className="w-40"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuItem
            onSelect={() => {
              openRenameDialog();
            }}
          >
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDelete}
            onSelect={handleDelete}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);

          if (open) {
            setRenameValue(mode);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename mode</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitRename();
              }
            }}
            placeholder="Mode name"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitRename()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TokenModeColumnHeader({
  mode,
  showAddControl,
  onAddMode,
  onRenameMode,
  onDeleteMode,
  canDeleteMode = true,
}: {
  mode: string;
  showAddControl?: boolean;
  onAddMode?: (mode: string) => void;
  onRenameMode?: (mode: string, newName: string) => Promise<boolean>;
  onDeleteMode?: (mode: string) => Promise<boolean>;
  canDeleteMode?: boolean;
}) {
  return (
    <div className="flex size-full min-w-0 items-center justify-between gap-2 text-sm">
      {onRenameMode && onDeleteMode ? (
        <ModeHeaderContextMenu
          mode={mode}
          canDelete={canDeleteMode}
          onRename={onRenameMode}
          onDelete={onDeleteMode}
        />
      ) : (
        <span className="truncate capitalize">{mode}</span>
      )}
      {showAddControl && onAddMode ? <AddModeControl onAdd={onAddMode} /> : null}
    </div>
  );
}
