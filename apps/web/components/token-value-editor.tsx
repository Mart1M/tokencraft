"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Link2Off, Plus, Trash2, WandSparkles } from "lucide-react";

import { TokenAliasCombobox } from "@/components/token-alias-combobox";
import { TokenColorPicker } from "@/components/token-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TokenAliasOption } from "@/lib/tokens/entries";
import { normalizeAliasInput } from "@/lib/tokens/json-patch";
import {
  getCompositeFieldsForType,
  isCompositeTokenType,
} from "@/lib/tokens/composite-fields";
import type { TokenValueKind } from "@/lib/tokens/draft-utils";
import {
  formatScalarPlaceholder,
  parseCompositionFieldValues,
  parseCompositeFieldValues,
  resolveStoredRawArray,
  serializeCompositionFieldValues,
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
  aliasOptions,
  onChange,
}: {
  type: string;
  rawValue: string;
  aliasOptions: TokenAliasOption[];
  onChange: (value: string) => void;
}) {
  const fields = getCompositeFieldsForType(type) ?? [];
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    parseCompositeFieldValues(type, rawValue)
  );
  const [autoOpenAliasField, setAutoOpenAliasField] = useState<string | null>(null);

  useEffect(() => {
    setFieldValues(parseCompositeFieldValues(type, rawValue));
  }, [rawValue, type]);

  function updateField(key: string, nextValue: string) {
    const next = { ...fieldValues, [key]: nextValue };
    setFieldValues(next);
    onChange(serializeCompositeFieldValues(type, next));
  }

  function isAliasValue(value: string) {
    return /^\{[^{}]*\}$/.test(value.trim());
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`${type}-${field.key}`}>
            {field.label}
          </label>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {isAliasValue(fieldValues[field.key] ?? "") ? (
                <TokenAliasCombobox
                  options={
                    field.aliasTypes?.length
                      ? aliasOptions.filter((option) =>
                          field.aliasTypes?.includes(option.type ?? ""),
                        )
                      : aliasOptions
                  }
                  value={fieldValues[field.key] ?? ""}
                  defaultOpen={autoOpenAliasField === field.key}
                  onValueChange={(path) =>
                    updateField(field.key, normalizeAliasInput(path))
                  }
                />
              ) : field.input === "color" ? (
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label={
                    isAliasValue(fieldValues[field.key] ?? "")
                      ? `Use a literal value for ${field.label}`
                      : `Reference another token for ${field.label}`
                  }
                  onClick={() => {
                    const isAlias = isAliasValue(fieldValues[field.key] ?? "");
                    setAutoOpenAliasField(isAlias ? null : field.key);
                    updateField(field.key, isAlias ? "" : "{}");
                  }}
                >
                  {isAliasValue(fieldValues[field.key] ?? "") ? (
                    <Link2Off className="size-4" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>
                  {isAliasValue(fieldValues[field.key] ?? "")
                    ? "Use a literal value instead"
                    : "Reference another token"}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

type CompositionField = {
  id: string;
  key: string;
  value: string;
};

function CompositionValueFields({
  rawValue,
  onChange,
}: {
  rawValue: string;
  onChange: (value: string) => void;
}) {
  const [fields, setFields] = useState<CompositionField[]>(() =>
    parseCompositionFieldValues(rawValue).map((field, index) => ({
      ...field,
      id: `${field.key}-${index}`,
    })),
  );

  useEffect(() => {
    setFields(
      parseCompositionFieldValues(rawValue).map((field, index) => ({
        ...field,
        id: `${field.key}-${index}`,
      })),
    );
  }, [rawValue]);

  function commit(next: CompositionField[]) {
    setFields(next);
    onChange(serializeCompositionFieldValues(next));
  }

  function addField() {
    setFields([...fields, { id: `new-${Date.now()}`, key: "", value: "" }]);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
        <span>Key</span>
        <span>Value</span>
      </div>
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_2rem] gap-2">
          <Input
            aria-label={`Composition key ${index + 1}`}
            value={field.key}
            onChange={(event) =>
              commit(fields.map((current) =>
                current.id === field.id ? { ...current, key: event.target.value } : current,
              ))
            }
            placeholder="typography"
            className="font-mono text-sm"
          />
          <Input
            aria-label={`Composition value ${index + 1}`}
            value={field.value}
            onChange={(event) =>
              commit(fields.map((current) =>
                current.id === field.id ? { ...current, value: event.target.value } : current,
              ))
            }
            placeholder="{vp.semantic.typography.screen-s.body-m}"
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Remove composition field ${index + 1}`}
            onClick={() => commit(fields.filter((current) => current.id !== field.id))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addField}>
        <Plus className="size-3.5" />
        Add field
      </Button>
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
  literalDisabled = false,
  onColorModifierClick,
  hasColorModifier = false,
}: {
  id: string;
  type?: string;
  valueKind: TokenValueKind;
  rawValue: string;
  raw?: StoredTokenRawValue;
  aliasOptions: TokenAliasOption[];
  onValueKindChange: (valueKind: TokenValueKind) => void;
  onRawValueChange: (rawValue: string) => void;
  literalDisabled?: boolean;
  onColorModifierClick?: () => void;
  hasColorModifier?: boolean;
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

  const colorModifierButton =
    type === "color" && onColorModifierClick ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={hasColorModifier ? "secondary" : "outline"}
            size="icon"
            className="shrink-0"
            onClick={onColorModifierClick}
            aria-label={hasColorModifier ? "Edit color modifier" : "Add color modifier"}
          >
            <WandSparkles className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{hasColorModifier ? "Edit color modifier" : "Add color modifier"}</p>
        </TooltipContent>
      </Tooltip>
    ) : null;

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
          {!literalDisabled ? (
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
          ) : null}
          {colorModifierButton}
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
      <CompositeValueFields
        type={type}
        rawValue={rawValue}
        aliasOptions={aliasOptions}
        onChange={onRawValueChange}
      />
    );
  } else if (type === "composition") {
    literalField = (
      <CompositionValueFields rawValue={rawValue} onChange={onRawValueChange} />
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

  const isCompositionValue = type === "composition";

  return (
    <div className={`flex gap-2 ${isCompositionValue ? "items-start" : "items-center"}`}>
      <div className="min-w-0 flex-1">{literalField}</div>
      {!literalDisabled && !usesCompositeFields ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={`shrink-0 ${isCompositionValue ? "mt-6" : ""}`}
              onClick={switchToAlias}
            >
              <Link2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Reference another token</p>
          </TooltipContent>
        </Tooltip>
      ) : null}
      {colorModifierButton}
    </div>
  );
}
