"use client";

import { Link2, Link2Off, Trash2 } from "lucide-react";

import { TokenAliasCombobox } from "@/components/token-alias-combobox";
import { TokenColorPicker } from "@/components/token-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COLOR_MODIFIER_SPACES,
  COLOR_MODIFIER_TYPES,
  type TokenColorModifier,
} from "@/lib/tokens/color-modifier";
import { resolveColorModifierPreview } from "@/lib/tokens/color-modifier-preview";
import type { ImportedTokenRow, TokenAliasOption } from "@/lib/tokens/entries";

function isColorReference(value?: string) {
  return Boolean(value?.trim().match(/^\{[^}]+\}$/));
}

export function TokenColorModifierEditor({
  value,
  onChange,
  colorAliases,
  rows,
  previewToken,
  mode = "Default",
}: {
  value?: TokenColorModifier;
  onChange: (value: TokenColorModifier | undefined) => void;
  colorAliases: TokenAliasOption[];
  rows: ImportedTokenRow[];
  previewToken: ImportedTokenRow;
  mode?: string;
}) {
  if (!value) {
    return null;
  }

  const preview = resolveColorModifierPreview(
    [...rows.filter((row) => row.id !== previewToken.id), previewToken],
    previewToken,
    mode,
  );

  function update(next: Partial<TokenColorModifier>) {
    onChange({ ...value, ...next } as TokenColorModifier);
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Modify color</p>
          <p className="text-xs text-muted-foreground">
            Saved in <code className="rounded bg-muted px-1 py-0.5">$extensions.tokencraft.modify</code>.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(undefined)} aria-label="Remove color modifier">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Operation</label>
        <Select
          value={value.type}
          onValueChange={(type: TokenColorModifier["type"]) =>
            onChange({ ...value, type, ...(type === "mix" ? {} : { color: undefined }) })
          }
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COLOR_MODIFIER_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Color space</label>
        <Select value={value.space} onValueChange={(space: TokenColorModifier["space"]) => update({ space })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COLOR_MODIFIER_SPACES.map((space) => <SelectItem key={space} value={space}>{space}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="token-modifier-value">Amount</label>
        <Input
          id="token-modifier-value"
          className="font-mono"
          value={value.value}
          onChange={(event) => update({ value: event.target.value })}
          placeholder="0.05 or {opacity.subtle}"
        />
      </div>

      {value.type === "mix" ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Mix with</label>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {isColorReference(value.color) ? (
                <TokenAliasCombobox
                  options={colorAliases}
                  value={value.color ?? ""}
                  onValueChange={(color) => update({ color: `{${color}}` })}
                />
              ) : (
                <TokenColorPicker
                  id="token-modifier-mix-color"
                  value={value.color ?? "#000000"}
                  onChange={(color) => update({ color })}
                />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={isColorReference(value.color) ? "Use a literal color" : "Reference a color token"}
              title={isColorReference(value.color) ? "Use a literal color" : "Reference a color token"}
              onClick={() => update({ color: isColorReference(value.color) ? "#000000" : "" })}
            >
              {isColorReference(value.color) ? <Link2Off className="size-4" /> : <Link2 className="size-4" />}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2">
        {preview.color ? (
          <span className="size-7 shrink-0 rounded border" style={{ backgroundColor: preview.color }} aria-label={`Resolved color ${preview.color}`} />
        ) : (
          <span className="size-7 shrink-0 rounded border bg-muted" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium">Resolved preview</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{preview.color ?? preview.error}</p>
        </div>
      </div>
    </div>
  );
}
