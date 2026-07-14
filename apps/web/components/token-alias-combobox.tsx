"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TokenAliasOption } from "@/lib/tokens/entries";
import { stripAliasBraces } from "@/lib/tokens/json-patch";
import { cn } from "@/lib/utils";

function normalizeAliasValue(value: string) {
  return stripAliasBraces(value);
}

export function TokenAliasCombobox({
  options,
  value,
  onValueChange,
  disabled,
}: {
  options: TokenAliasOption[];
  value: string;
  onValueChange: (path: string) => void;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedValue = normalizeAliasValue(value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const haystack = [
        option.path,
        option.type ?? "",
        option.collectionName,
        option.sourcePath,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, TokenAliasOption[]>();

    for (const option of filteredOptions) {
      const current = groups.get(option.collectionName) ?? [];
      current.push(option);
      groups.set(option.collectionName, current);
    }

    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filteredOptions]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        className="h-10 w-full justify-between font-mono text-sm font-normal"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">
          {normalizedValue || "Select a token alias..."}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </Button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full rounded-lg border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tokens..."
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div
            id={listboxId}
            role="listbox"
            className="max-h-72 overflow-y-auto p-1"
          >
            {groupedOptions.length > 0 ? (
              groupedOptions.map(([collectionName, collectionOptions]) => (
                <div key={collectionName} className="py-1">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {collectionName}
                  </p>
                  {collectionOptions.map((option) => {
                    const isSelected = option.path === normalizedValue;

                    return (
                      <button
                        key={option.path}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                          isSelected && "bg-accent"
                        )}
                        onClick={() => {
                          onValueChange(option.path);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-sm">
                            {option.path}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {option.type ? (
                              <Badge variant="outline" className="font-normal">
                                {option.type}
                              </Badge>
                            ) : null}
                            <span className="truncate text-xs text-muted-foreground">
                              {option.sourcePath}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No tokens match your search.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
