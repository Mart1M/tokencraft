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
    const nextModes: Record<string, unknown> = {};

    for (const [modeName, display] of Object.entries(current.modes)) {
      nextModes[modeName] = modeName === mode ? formatted : displayToRaw(display);
    }

    // `current.modes` only contains modes that already have a value for
    // this token; a brand-new mode (e.g. one just added in the UI) won't be
    // in there yet, so make sure it still ends up in the written value.
    if (!(mode in nextModes)) {
      nextModes[mode] = formatted;
    }

    if (current.raw && typeof current.raw === "object" && !Array.isArray(current.raw)) {
      return {
        ...(current.raw as Record<string, unknown>),
        ...nextModes,
      };
    }

    return nextModes;
  }

  if (mode && !current.modes) {
    // Token only has a flat value so far; seed a modes map so the existing
    // value isn't discarded when a value is set under a new mode.
    const existingRaw =
      current.raw !== undefined
        ? current.raw
        : rawValueFromDisplay(current.value, current.type, current.display);

    return {
      Default: existingRaw,
      [mode]: formatted,
    };
  }

  return rawValueFromDisplay(formatted, current.type, current.display);
}
