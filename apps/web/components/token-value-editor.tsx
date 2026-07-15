"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Link2Off } from "lucide-react";

import { TokenAliasCombobox } from "@/components/token-alias-combobox";
import { TokenColorPicker } from "@/components/token-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TokenAliasOption } from "@/lib/tokens/entries";
import {
  getCompositeFieldsForType,
  isCompositeTokenType,
} from "@/lib/tokens/composite-fields";
import type { TokenValueKind } from "@/lib/tokens/draft-utils";
import {
  formatScalarPlaceholder,
  parseCompositeFieldValues,
  resolveStoredRawArray,
  serializeCompositeFieldValues,
  tryParseJsonValue,
} from "@/lib/tokens/value-editor";
import type { StoredTokenRawValue } from "@/lib/tokens/raw-value";

function ColorFieldInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return <TokenColorPicker id={id} value={value} onChange={onChange} />;
}

function CompositeValueFields({
  type,
  rawValue,
  onChange,
}: {
  type: string;
  rawValue: string;
  onChange: (value: string) => void;
}) {
  const fields = getCompositeFieldsForType(type) ?? [];
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    parseCompositeFieldValues(type, rawValue)
  );

  useEffect(() => {
    setFieldValues(parseCompositeFieldValues(type, rawValue));
  }, [rawValue, type]);

  function updateField(key: string, nextValue: string) {
    const next = { ...fieldValues, [key]: nextValue };
    setFieldValues(next);
    onChange(serializeCompositeFieldValues(type, next));
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`${type}-${field.key}`}>
            {field.label}
          </label>
          {field.input === "color" ? (
            <ColorFieldInput
              id={`${type}-${field.key}`}
              value={fieldValues[field.key] ?? ""}
              onChange={(value) => updateField(field.key, value)}
            />
          ) : (
            <Input
              id={`${type}-${field.key}`}
              value={fieldValues[field.key] ?? ""}
              onChange={(event) => updateField(field.key, event.target.value)}
              placeholder={field.placeholder}
              className="font-mono"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function TokenValueEditor({
  id,
  type,
  valueKind,
  rawValue,
  raw,
  aliasOptions,
  onValueKindChange,
  onRawValueChange,
}: {
  id: string;
  type?: string;
  valueKind: TokenValueKind;
  rawValue: string;
  raw?: StoredTokenRawValue;
  aliasOptions: TokenAliasOption[];
  onValueKindChange: (valueKind: TokenValueKind) => void;
  onRawValueChange: (rawValue: string) => void;
}) {
  const compositeArray = useMemo(
    () => (type && isCompositeTokenType(type) ? resolveStoredRawArray(raw) : null),
    [raw, type]
  );
  const parsedRawValue = useMemo(() => tryParseJsonValue(rawValue), [rawValue]);
  const usesCompositeFields =
    Boolean(type && isCompositeTokenType(type)) &&
    valueKind === "literal" &&
    !compositeArray &&
    (parsedRawValue === null ||
      (typeof parsedRawValue === "object" && !Array.isArray(parsedRawValue)));

  const [autoOpenAlias, setAutoOpenAlias] = useState(false);

  useEffect(() => {
    if (autoOpenAlias) {
      setAutoOpenAlias(false);
    }
  }, [autoOpenAlias]);

  function switchToAlias() {
    setAutoOpenAlias(true);
    onValueKindChange("alias");
  }

  if (valueKind === "alias") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <TokenAliasCombobox
              options={aliasOptions}
              value={rawValue}
              onValueChange={onRawValueChange}
              defaultOpen={autoOpenAlias}
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => onValueKindChange("literal")}
              >
                <Link2Off className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Use a literal value instead</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">
          Pick a token from any imported collection. The alias is stored as{" "}
          <code className="rounded bg-muted px-1 py-0.5">{`{token.path}`}</code>.
        </p>
      </div>
    );
  }

  let literalField: React.ReactNode;

  if (type === "color") {
    literalField = <ColorFieldInput id={id} value={rawValue} onChange={onRawValueChange} />;
  } else if (usesCompositeFields && type) {
    literalField = (
      <CompositeValueFields type={type} rawValue={rawValue} onChange={onRawValueChange} />
    );
  } else if (
    compositeArray ||
    (type && isCompositeTokenType(type) && rawValue.trim().startsWith("["))
  ) {
    literalField = (
      <Textarea
        id={id}
        value={rawValue}
        onChange={(event) => onRawValueChange(event.target.value)}
        className="min-h-32 font-mono text-sm"
        placeholder='[{"offsetX":"0px","offsetY":"1px"}]'
      />
    );
  } else {
    literalField = (
      <Input
        id={id}
        value={rawValue}
        onChange={(event) => onRawValueChange(event.target.value)}
        placeholder={formatScalarPlaceholder(type)}
        className="font-mono"
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{literalField}</div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={switchToAlias}
          >
            <Link2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Reference another token</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
