"use client";

import { useEffect, useMemo, useState } from "react";

import { TokenAliasCombobox } from "@/components/token-alias-combobox";
import { TokenColorPicker } from "@/components/token-color-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  if (valueKind === "alias") {
    return (
      <div className="space-y-2">
        <TokenAliasCombobox
          options={aliasOptions}
          value={rawValue}
          onValueChange={onRawValueChange}
        />
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => onValueKindChange("literal")}
        >
          Switch to literal value
        </button>
      </div>
    );
  }

  if (type === "color") {
    return <ColorFieldInput id={id} value={rawValue} onChange={onRawValueChange} />;
  }

  if (usesCompositeFields && type) {
    return <CompositeValueFields type={type} rawValue={rawValue} onChange={onRawValueChange} />;
  }

  if (compositeArray || (type && isCompositeTokenType(type) && rawValue.trim().startsWith("["))) {
    return (
      <Textarea
        id={id}
        value={rawValue}
        onChange={(event) => onRawValueChange(event.target.value)}
        className="min-h-32 font-mono text-sm"
        placeholder='[{"offsetX":"0px","offsetY":"1px"}]'
      />
    );
  }

  return (
    <Input
      id={id}
      value={rawValue}
      onChange={(event) => onRawValueChange(event.target.value)}
      placeholder={formatScalarPlaceholder(type)}
      className="font-mono"
    />
  );
}
