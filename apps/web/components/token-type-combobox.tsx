"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TOKEN_TYPE_OPTIONS } from "@/lib/tokens/token-types";
import { cn } from "@/lib/utils";

export function TokenTypeCombobox({
  id,
  value,
  onValueChange,
  disabled,
}: {
  id?: string;
  value: string;
  onValueChange: (type: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const matchesExistingOption = TOKEN_TYPE_OPTIONS.some(
    (option) => option.value.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const selectedOption = TOKEN_TYPE_OPTIONS.find(
    (option) => option.value === value,
  );

  function selectType(type: string) {
    onValueChange(type);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between font-mono text-sm font-normal"
        >
          <span className="truncate">
            {value ? selectedOption?.label ?? value : "Select a type..."}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search types..."
          />
          <CommandList>
            <CommandEmpty>No matching type.</CommandEmpty>
            <CommandGroup>
              {TOKEN_TYPE_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  keywords={[option.value]}
                  onSelect={() => selectType(option.value)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1">{option.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {option.value}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmedQuery && !matchesExistingOption ? (
              <CommandGroup>
                <CommandItem
                  value={trimmedQuery}
                  onSelect={() => selectType(trimmedQuery)}
                >
                  Use &quot;{trimmedQuery}&quot;
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
