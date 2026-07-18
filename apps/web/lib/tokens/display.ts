import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import { getCompositeFieldKeys } from "@/lib/tokens/composite-fields";
import { toStoredTokenRawValue } from "@/lib/tokens/raw-value";

export type TokenDisplayPart =
  | { kind: "text"; text: string }
  | { kind: "alias"; text: string; aliasPath: string }
  | { kind: "color"; text: string; color: string };

export type TokenDisplayValue = {
  kind: "color" | "alias" | "text" | "composite";
  text: string;
  color?: string;
  aliasPath?: string;
  parts?: TokenDisplayPart[];
};

export const MODE_KEYS = new Set([
  "light",
  "dark",
  "default",
  "compact",
  "hover",
  "active",
]);

const ALIAS_PATTERN = /^\{([^}]+)\}$/;
const INLINE_ALIAS_PATTERN = /\{[^}]+\}/g;

const COMPOSITE_FIELD_ORDER: Record<string, string[]> = {
  border: getCompositeFieldKeys("border"),
  typography: getCompositeFieldKeys("typography"),
  transition: getCompositeFieldKeys("transition"),
  shadow: getCompositeFieldKeys("shadow"),
  asset: getCompositeFieldKeys("asset"),
  strokeStyle: getCompositeFieldKeys("strokeStyle"),
  composition: [],
};

// Composite token types (e.g. Tokens Studio "composition" tokens) store a
// bundle of style-category references keyed by field names such as
// "typography", "fontWeight", or "delay". These collide with the shape of a
// mode map (plain object, string/number/object values, no "$value") but are
// not modes, so they must not be misdetected as one.
const RESERVED_COMPOSITE_FIELD_KEYS = new Set([
  "typography",
  "border",
  "boxShadow",
  "shadow",
  "transition",
  "asset",
  "strokeStyle",
  "fill",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textCase",
  "textDecoration",
  "opticalSizing",
  "underliningOffset",
  "duration",
  "delay",
  "easing",
  "timingFunction",
  "offsetX",
  "offsetY",
  "blur",
  "spread",
  "inset",
  "width",
  "lineWidth",
  "style",
  "dashArray",
  "lineCap",
  "url",
  "format",
]);

export function looksLikeModeMap(value: Record<string, unknown>, type?: string) {
  if (type === "composition") {
    return false;
  }

  if ("$value" in value || "$type" in value || "value" in value) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length === 0) {
    return false;
  }

  if (keys.some((key) => RESERVED_COMPOSITE_FIELD_KEYS.has(key))) {
    return false;
  }

  return keys.every((key) => {
    if (key.startsWith("$")) {
      return false;
    }

    const modeValue = value[key];

    return (
      modeValue === null ||
      typeof modeValue === "string" ||
      typeof modeValue === "number" ||
      typeof modeValue === "boolean" ||
      (typeof modeValue === "object" && modeValue !== null && !Array.isArray(modeValue))
    );
  });
}

function findModeKey(modes: Record<string, TokenDisplayValue>, activeMode: string | null) {
  if (!activeMode) {
    return null;
  }

  if (modes[activeMode]) {
    return activeMode;
  }

  const normalized = activeMode.toLowerCase();
  return Object.keys(modes).find((mode) => mode.toLowerCase() === normalized) ?? null;
}

export function resolveModeKey(
  modes: Record<string, TokenDisplayValue>,
  activeMode: string | null
) {
  return findModeKey(modes, activeMode);
}

export function resolveStoredTokenModes(entry: {
  modes?: Record<string, TokenDisplayValue>;
  raw?: import("@/lib/tokens/raw-value").StoredTokenRawValue;
  value: string;
  type?: string;
}): Record<string, TokenDisplayValue> | undefined {
  if (entry.modes && Object.keys(entry.modes).length > 0) {
    return entry.modes;
  }

  if (
    entry.raw &&
    typeof entry.raw === "object" &&
    !Array.isArray(entry.raw) &&
    looksLikeModeMap(entry.raw as Record<string, unknown>, entry.type)
  ) {
    const modes: Record<string, TokenDisplayValue> = {};

    for (const [mode, modeValue] of Object.entries(entry.raw)) {
      modes[mode] = buildTokenDisplayValue(modeValue, entry.type);
    }

    return modes;
  }

  return parseLegacyModeValue(entry.value, entry.type);
}

export function parseCssColor(value: string) {
  const trimmed = value.trim();

  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }

  if (/^(rgb|rgba|hsl|hsla)\(.+\)$/i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

export function resolveDisplayColor(value: TokenDisplayValue): string | undefined {
  if (value.kind === "color" && value.color) {
    return value.color;
  }

  if (value.kind === "text") {
    return parseCssColor(value.text);
  }

  return undefined;
}

function buildPartFromRaw(raw: unknown, valueType?: string): TokenDisplayPart {
  if (typeof raw === "string") {
    const aliasMatch = raw.match(ALIAS_PATTERN);

    if (aliasMatch) {
      return {
        kind: "alias",
        text: raw,
        aliasPath: aliasMatch[1],
      };
    }

    const color = parseCssColor(raw);

    if (color) {
      return { kind: "color", text: raw, color };
    }

    return { kind: "text", text: raw };
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    return { kind: "text", text: String(raw) };
  }

  return { kind: "text", text: formatDtcgTokenValue(raw, valueType) };
}

export function parseAliasSegments(text: string): TokenDisplayPart[] {
  const parts: TokenDisplayPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_ALIAS_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      const chunk = text.slice(lastIndex, index);

      if (chunk) {
        parts.push({ kind: "text", text: chunk });
      }
    }

    parts.push({
      kind: "alias",
      text: match[0],
      aliasPath: match[0].slice(1, -1),
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    const chunk = text.slice(lastIndex);

    if (chunk) {
      parts.push({ kind: "text", text: chunk });
    }
  }

  return parts;
}

function hasAliasPart(parts: TokenDisplayPart[]) {
  return parts.some((part) => part.kind === "alias");
}

export function parseStringIntoComposite(text: string): TokenDisplayValue {
  const parts = parseAliasSegments(text);

  if (!hasAliasPart(parts)) {
    return { kind: "text", text };
  }

  return { kind: "composite", text, parts };
}

function buildCompositeDisplay(
  raw: Record<string, unknown>,
  type?: string
): TokenDisplayValue | null {
  if (!type) {
    return null;
  }

  const orderedKeys =
    type === "composition" ? Object.keys(raw) : COMPOSITE_FIELD_ORDER[type];

  if (!orderedKeys) {
    return null;
  }

  const parts: TokenDisplayPart[] = [];

  for (const key of orderedKeys) {
    if (raw[key] === undefined || raw[key] === null) {
      continue;
    }

    if (parts.length > 0) {
      parts.push({ kind: "text", text: " " });
    }

    if (type === "typography" || type === "composition") {
      parts.push({ kind: "text", text: `${key}: ` });
    }

    parts.push(
      buildPartFromRaw(
        raw[key],
        (type === "border" || type === "shadow") && key === "color" ? "color" : undefined
      )
    );
  }

  for (const key of Object.keys(raw)) {
    if (orderedKeys.includes(key) || raw[key] === undefined || raw[key] === null) {
      continue;
    }

    if (parts.length > 0) {
      parts.push({ kind: "text", text: " " });
    }

    parts.push(buildPartFromRaw(raw[key], key === "color" ? "color" : undefined));
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    kind: "composite",
    text: formatDtcgTokenValue(raw, type),
    parts,
  };
}

export function buildTokenDisplayValue(raw: unknown, type?: string): TokenDisplayValue {
  if (typeof raw === "string") {
    const aliasMatch = raw.match(ALIAS_PATTERN);

    if (aliasMatch) {
      return {
        kind: "alias",
        text: raw,
        aliasPath: aliasMatch[1],
      };
    }

    const color = parseCssColor(raw);

    if (color) {
      return { kind: "color", text: raw, color };
    }

    if (raw.includes("{") && raw.includes("}")) {
      return parseStringIntoComposite(raw);
    }

    return { kind: "text", text: raw };
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    return { kind: "text", text: String(raw) };
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const composite = buildCompositeDisplay(raw as Record<string, unknown>, type);

    if (composite) {
      return composite;
    }

    return { kind: "text", text: formatDtcgTokenValue(raw, type) };
  }

  return { kind: "text", text: formatDtcgTokenValue(raw, type) };
}

export function buildStoredTokenEntry(
  path: string,
  type: string | undefined,
  rawValue: unknown
) {
  if (
    rawValue &&
    typeof rawValue === "object" &&
    !Array.isArray(rawValue) &&
    looksLikeModeMap(rawValue as Record<string, unknown>, type)
  ) {
    const modes: Record<string, TokenDisplayValue> = {};

    for (const [mode, modeValue] of Object.entries(rawValue as Record<string, unknown>)) {
      modes[mode] = buildTokenDisplayValue(modeValue, type);
    }

    return {
      path,
      ...(type ? { type } : {}),
      value: formatDtcgTokenValue(rawValue, type),
      ...(toStoredTokenRawValue(rawValue) !== undefined
        ? { raw: toStoredTokenRawValue(rawValue) }
        : {}),
      modes,
    };
  }

  const display = buildTokenDisplayValue(rawValue, type);

  return {
    path,
    ...(type ? { type } : {}),
    value:
      display.kind === "composite"
        ? formatDtcgTokenValue(rawValue, type)
        : display.text,
    ...(toStoredTokenRawValue(rawValue) !== undefined
      ? { raw: toStoredTokenRawValue(rawValue) }
      : {}),
    display,
  };
}

export function buildTokenDisplayValueFromString(
  value: string,
  type?: string
): TokenDisplayValue {
  const display = buildTokenDisplayValue(value, type);

  if (display.kind === "text" && value.includes("{") && value.includes("}")) {
    return parseStringIntoComposite(value);
  }

  return display;
}

export function parseLegacyModeValue(
  value: string,
  type?: string
): Record<string, TokenDisplayValue> | undefined {
  const parts = value.split(" · ");

  if (parts.length < 2) {
    return undefined;
  }

  const modes: Record<string, TokenDisplayValue> = {};

  for (const part of parts) {
    const separatorIndex = part.indexOf(": ");

    if (separatorIndex === -1) {
      return undefined;
    }

    const mode = part.slice(0, separatorIndex);

    if (!MODE_KEYS.has(mode)) {
      return undefined;
    }

    modes[mode] = buildTokenDisplayValueFromString(part.slice(separatorIndex + 2), type);
  }

  return modes;
}

const MODE_ORDER = ["light", "dark", "default", "compact", "hover", "active"];

export function collectTokenModes(
  rows: Array<{ modes?: Record<string, TokenDisplayValue> }>
) {
  const modeSet = new Set<string>();

  for (const row of rows) {
    if (row.modes) {
      for (const mode of Object.keys(row.modes)) {
        modeSet.add(mode);
      }
    }
  }

  return [...modeSet].sort((left, right) => {
    const leftIndex = MODE_ORDER.indexOf(left);
    const rightIndex = MODE_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

export function getDefaultMode(modes: string[]) {
  const lightMode = modes.find((mode) => mode.toLowerCase() === "light");
  if (lightMode) {
    return lightMode;
  }

  const defaultMode = modes.find((mode) => mode.toLowerCase() === "default");
  if (defaultMode) {
    return defaultMode;
  }

  return modes[0] ?? null;
}

export function getRowModeDisplayValue(
  row: {
    value: string;
    type?: string;
    display?: TokenDisplayValue;
    modes?: Record<string, TokenDisplayValue>;
  },
  mode: string
): TokenDisplayValue | null {
  const activeMode = mode === "Default" ? null : mode;

  if (row.modes && Object.keys(row.modes).length > 0) {
    const modeKey = findModeKey(row.modes, activeMode);

    if (modeKey) {
      return row.modes[modeKey];
    }

    // No mode was selected (the "Default" column): fall back to the first
    // available mode value rather than showing an empty cell.
    return !activeMode ? Object.values(row.modes)[0] ?? null : null;
  }

  const legacyModes = parseLegacyModeValue(row.value, row.type);

  if (legacyModes) {
    const modeKey = findModeKey(legacyModes, activeMode);

    if (modeKey) {
      return legacyModes[modeKey];
    }

    return !activeMode ? Object.values(legacyModes)[0] ?? null : null;
  }

  if (!activeMode) {
    return row.display ?? buildTokenDisplayValueFromString(row.value, row.type);
  }

  return null;
}

export function getRowDisplayValue(
  row: {
    value: string;
    type?: string;
    display?: TokenDisplayValue;
    modes?: Record<string, TokenDisplayValue>;
  },
  activeMode: string | null
): TokenDisplayValue {
  if (row.modes) {
    const modeKey = findModeKey(row.modes, activeMode);

    if (modeKey) {
      return row.modes[modeKey];
    }

    const firstModeValue = Object.values(row.modes)[0];
    if (firstModeValue) {
      return firstModeValue;
    }
  }

  if (row.display) {
    if (row.display.kind === "text" && row.value.includes("{") && row.value.includes("}")) {
      return parseStringIntoComposite(row.value);
    }

    return row.display;
  }

  const legacyModes = parseLegacyModeValue(row.value, row.type);

  if (legacyModes) {
    const modeKey = findModeKey(legacyModes, activeMode);

    if (modeKey) {
      return legacyModes[modeKey];
    }

    const firstLegacyMode = Object.values(legacyModes)[0];
    if (firstLegacyMode) {
      return firstLegacyMode;
    }
  }

  return buildTokenDisplayValueFromString(row.value, row.type);
}

export function isTokenDisplayPart(value: unknown): value is TokenDisplayPart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const part = value as TokenDisplayPart;

  if (part.kind === "text") {
    return typeof part.text === "string";
  }

  if (part.kind === "alias") {
    return typeof part.text === "string" && typeof part.aliasPath === "string";
  }

  if (part.kind === "color") {
    return typeof part.text === "string" && typeof part.color === "string";
  }

  return false;
}

export function isTokenDisplayValue(value: unknown): value is TokenDisplayValue {
  if (!value || typeof value !== "object") {
    return false;
  }

  const display = value as TokenDisplayValue;

  if (typeof display.kind !== "string" || typeof display.text !== "string") {
    return false;
  }

  if (display.parts !== undefined) {
    return Array.isArray(display.parts) && display.parts.every(isTokenDisplayPart);
  }

  return true;
}
