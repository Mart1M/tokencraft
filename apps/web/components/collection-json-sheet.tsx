"use client";

import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";
import { Braces, Copy, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildTokensFromJsonDocuments,
} from "@/lib/tokens/collection-json-preview";
import { useTokenDraftStore } from "@/lib/tokens/draft-store";
import { cn } from "@/lib/utils";

type JsonDocument = {
  mode: string | null;
  path: string;
  content: string | null;
  error?: string;
};

type CollectionJsonResponse = {
  collectionName: string;
  modeStorage: string;
  documents: JsonDocument[];
  error?: string;
};

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function CollectionJsonSheet({
  open,
  onOpenChange,
  rootPath,
  fileId,
  collectionName,
  sourcePath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootPath: string;
  fileId: string | null;
  collectionName?: string;
  sourcePath?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<JsonDocument[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState(collectionName ?? "Collection");
  const debounceRef = useRef<number | null>(null);
  const isDark = useIsDarkMode();
  const stageJsonDocuments = useTokenDraftStore((state) => state.stageJsonDocuments);
  const pendingFileWrites = useTokenDraftStore((state) => state.pendingFileWrites);

  const extensions = useMemo(() => [json()], []);
  const editorTheme = useMemo(() => (isDark ? oneDark : undefined), [isDark]);

  const syncPreview = useCallback(
    (nextDocuments: JsonDocument[], nextTitle: string) => {
      if (!fileId) {
        return;
      }

      const editable = nextDocuments.filter(
        (document): document is JsonDocument & { content: string } =>
          typeof document.content === "string",
      );

      if (editable.length === 0) {
        return;
      }

      const preview = buildTokensFromJsonDocuments({
        fileId,
        collectionName: nextTitle,
        sourcePath: sourcePath ?? editable[0]?.path ?? "",
        documents: editable.map((document) => ({
          mode: document.mode,
          path: document.path,
          content: document.content,
        })),
      });

      if (!preview.ok) {
        setParseError(preview.error);
        return;
      }

      setParseError(null);
      stageJsonDocuments({
        fileId,
        tokens: preview.tokens,
        documents: editable.map((document) => ({
          path: document.path,
          content: document.content.endsWith("\n")
            ? document.content
            : `${document.content}\n`,
        })),
      });
    },
    [fileId, sourcePath, stageJsonDocuments],
  );

  useEffect(() => {
    if (!open || !fileId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setParseError(null);
      setCopied(false);

      try {
        const response = await fetch(
          `/api/workspaces/collection-json?root=${encodeURIComponent(rootPath)}&fileId=${encodeURIComponent(fileId!)}`,
          { cache: "no-store" },
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as CollectionJsonResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load JSON.");
        }

        if (cancelled) {
          return;
        }

        const writes = useTokenDraftStore.getState().pendingFileWrites;
        const nextDocuments = (payload.documents ?? []).map((document) => {
          const pending = writes[document.path];
          if (pending && pending.fileId === fileId) {
            return { ...document, content: pending.content, error: undefined };
          }
          return document;
        });

        setDocuments(nextDocuments);
        setTitle(payload.collectionName || collectionName || "Collection");
        setActiveIndex(0);
      } catch (loadError) {
        if (!cancelled) {
          setDocuments([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load JSON.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [open, fileId, rootPath, collectionName]);

  const activeDocument = documents[activeIndex] ?? null;
  const showTabs = documents.length > 1;
  const hasPendingWrite =
    Boolean(fileId) &&
    documents.some(
      (document) =>
        document.path in pendingFileWrites &&
        pendingFileWrites[document.path]?.fileId === fileId,
    );

  function handleEditorChange(value: string) {
    if (!activeDocument) {
      return;
    }

    const nextDocuments = documents.map((document, index) =>
      index === activeIndex
        ? { ...document, content: value, error: undefined }
        : document,
    );
    setDocuments(nextDocuments);
    setCopied(false);

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      syncPreview(nextDocuments, title);
    }, 180);
  }

  async function handleCopy() {
    if (!activeDocument?.content) {
      return;
    }

    await navigator.clipboard.writeText(activeDocument.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex max-w-2xl flex-col shadow-xl" showCloseButton>
        <SheetHeader className="shrink-0 border-b px-5 py-3">
          <div className="flex items-center justify-between gap-3 pr-7">
            <div className="min-w-0">
              <SheetTitle className="truncate">{title}</SheetTitle>
              {activeDocument?.path ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {activeDocument.path}
                  {hasPendingWrite ? " · unsaved" : ""}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              disabled={!activeDocument?.content}
              onClick={() => void handleCopy()}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </SheetHeader>

        {showTabs ? (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-5 py-2">
            {documents.map((document, index) => (
              <button
                key={`${document.mode ?? "default"}-${document.path}`}
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  setCopied(false);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  index === activeIndex
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {document.mode ?? "Default"}
              </button>
            ))}
          </div>
        ) : null}

        {(parseError || error) && !isLoading ? (
          <p className="shrink-0 border-b px-5 py-2 text-xs text-destructive">
            {parseError ?? error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading JSON…</p>
          ) : error && documents.length === 0 ? (
            <p className="p-5 text-sm text-destructive">{error}</p>
          ) : activeDocument?.error ? (
            <p className="p-5 text-sm text-destructive">{activeDocument.error}</p>
          ) : activeDocument?.content !== null && activeDocument?.content !== undefined ? (
            <CodeMirror
              value={activeDocument.content}
              height="100%"
              theme={editorTheme}
              extensions={extensions}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                bracketMatching: true,
              }}
              onChange={handleEditorChange}
              className="h-full text-[12px] [&_.cm-editor]:h-full [&_.cm-scroller]:font-mono"
            />
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No JSON to display.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CollectionJsonButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="gap-1.5"
    >
      <Braces size={14} />
      JSON
    </Button>
  );
}
