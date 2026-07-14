import {
  parseLegacyModeValue,
  type TokenDisplayValue,
} from "@/lib/tokens/display";
import type { StoredTokenEntry } from "@/lib/tokens/flatten";
import { coerceJsonValue } from "@/lib/tokens/json-patch";

function displayToRaw(display: TokenDisplayValue) {
  if (display.kind === "alias") {
    return `{${display.aliasPath ?? display.text.replace(/^\{|\}$/g, "")}}`;
  }

  if (display.kind === "color") {
    return display.text;
  }

  if (display.kind === "composite" && display.parts) {
    return display.text;
  }

  return display.text;
}

export function entryToRawValue(entry: StoredTokenEntry) {
  if (entry.raw !== undefined) {
    return entry.raw;
  }

  if (entry.modes) {
    return Object.fromEntries(
      Object.entries(entry.modes).map(([mode, display]) => [mode, displayToRaw(display)])
    );
  }

  const legacyModes = parseLegacyModeValue(entry.value, entry.type);

  if (legacyModes) {
    return Object.fromEntries(
      Object.entries(legacyModes).map(([mode, display]) => [mode, displayToRaw(display)])
    );
  }

  if (entry.display) {
    return displayToRaw(entry.display);
  }

  if (entry.type) {
    return coerceJsonValue(entry.value, entry.type);
  }

  return entry.value;
}

export function rawValueFromDisplay(
  value: string | Record<string, unknown> | unknown,
  type: string | undefined,
  display?: TokenDisplayValue
) {
  if (display?.kind === "alias") {
    return `{${display.aliasPath ?? String(value).replace(/^\{|\}$/g, "")}}`;
  }

  if (value && typeof value === "object") {
    return value;
  }

  return coerceJsonValue(String(value), type);
}

export function buildRawValueFromDraftInput(
  current: StoredTokenEntry,
  formatted: string | Record<string, unknown> | unknown,
  mode?: string | null
) {
  if (mode && current.modes) {
    const nextModes = Object.fromEntries(
      Object.entries(current.modes).map(([modeName, display]) => [
        modeName,
        modeName === mode ? formatted : displayToRaw(display),
      ])
    );

    if (current.raw && typeof current.raw === "object" && !Array.isArray(current.raw)) {
      return {
        ...(current.raw as Record<string, unknown>),
        ...nextModes,
      };
    }

    return nextModes;
  }

  return rawValueFromDisplay(formatted, current.type, current.display);
}
