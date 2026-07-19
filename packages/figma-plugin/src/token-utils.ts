import type { TokenCraftToken, TokenDisplayValue } from "./protocol";

export type FigmaVariableType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

export function getCollectionKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

export type TokenValue =
  | { kind: "alias"; path: string }
  | { kind: "color"; value: RGBA }
  | { kind: "float"; value: number }
  | { kind: "string"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "invalid"; reason: string };

export function getFigmaVariableType(type?: string): FigmaVariableType | null {
  switch (type) {
    case "color":
      return "COLOR";
    case "number":
    case "fontWeight":
    case "dimension":
    case "duration":
      return "FLOAT";
    case "boolean":
      return "BOOLEAN";
    case "fontFamily":
    case "strokeStyle":
      return "STRING";
    default:
      return null;
  }
}

export function toFigmaVariableName(tokenName: string) {
  return tokenName.split(".").filter(Boolean).join("/");
}

export function getTokenModeValue(token: TokenCraftToken, mode: string) {
  const display = token.modes?.[mode] ?? (mode === "Default" ? token.display : undefined);
  return getDisplayText(display) ?? token.value;
}

/**
 * Returns the structured DTCG value for composite tokens. A token with modes
 * stores one object per mode; a single-mode token stores the object directly.
 */
export function getCompositeTokenValue(token: TokenCraftToken, mode: string): Record<string, unknown> | null {
  if (!isRecord(token.raw)) return null;
  if (token.modes && isRecord(token.raw[mode])) return token.raw[mode];
  return token.raw;
}

export function getCompositeProperty(
  token: TokenCraftToken,
  mode: string,
  ...names: string[]
): unknown {
  const value = getCompositeTokenValue(token, mode);
  if (!value) return undefined;
  for (const name of names) {
    if (name in value) return value[name];
  }
  return undefined;
}

/** Converts a CSS/DTCG font stack into the concrete family names Figma exposes. */
export function getFontFamilyCandidates(value: string) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function getDisplayText(display?: TokenDisplayValue) {
  if (!display) return undefined;
  if (display.kind === "alias" && display.aliasPath) return `{${display.aliasPath}}`;
  return display.text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTokenValue(raw: string, type: FigmaVariableType): TokenValue {
  const value = raw.trim();
  const alias = value.match(/^\{([^{}]+)\}$/);

  if (alias) return { kind: "alias", path: alias[1] };

  if (type === "COLOR") {
    const color = parseColor(value);
    return color ? { kind: "color", value: color } : { kind: "invalid", reason: `Unsupported color value “${raw}”.` };
  }

  if (type === "FLOAT") {
    const number = Number.parseFloat(value);
    return Number.isFinite(number)
      ? { kind: "float", value: number }
      : { kind: "invalid", reason: `“${raw}” is not a numeric value.` };
  }

  if (type === "BOOLEAN") {
    if (value === "true") return { kind: "boolean", value: true };
    if (value === "false") return { kind: "boolean", value: false };
    return { kind: "invalid", reason: `“${raw}” is not a boolean.` };
  }

  return { kind: "string", value: raw };
}

function parseColor(value: string): RGBA | null {
  const hex = value.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (hex) {
    const source = hex[1];
    const expanded = source.length <= 4
      ? source.split("").map((part) => part + part).join("")
      : source;
    const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
    const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
    const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;
    const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
    return { r: red, g: green, b: blue, a: alpha };
  }

  const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/i);
  if (!rgb) return null;

  const [red, green, blue] = rgb.slice(1, 4).map(Number);
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
  if (![red, green, blue, alpha].every(Number.isFinite)) return null;
  return { r: red / 255, g: green / 255, b: blue / 255, a: alpha };
}
