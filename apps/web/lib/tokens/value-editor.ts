import {
  getCompositeFieldsForType,
  isCompositeTokenType,
} from "@/lib/tokens/composite-fields";
import type { StoredTokenRawValue } from "@/lib/tokens/raw-value";

export function getDefaultLiteralValueForType(type: string) {
  if (type === "color") {
    return "#0066FF";
  }

  if (type === "dimension") {
    return "16px";
  }

  if (type === "duration") {
    return "200ms";
  }

  if (type === "number" || type === "fontWeight") {
    return "400";
  }

  if (type === "fontFamily") {
    return "Inter, sans-serif";
  }

  if (type === "cubicBezier") {
    return "0, 0, 0.2, 1";
  }

  if (isCompositeTokenType(type)) {
    return serializeCompositeFieldValues(type, createDefaultCompositeFieldValues(type));
  }

  return "";
}

export function createDefaultCompositeFieldValues(type: string) {
  const fields = getCompositeFieldsForType(type) ?? [];
  const values: Record<string, string> = {};

  for (const field of fields) {
    values[field.key] = field.placeholder ?? "";
  }

  return values;
}

export function objectToCompositeFieldValues(
  type: string,
  value: Record<string, unknown>
) {
  const fields = getCompositeFieldsForType(type) ?? [];
  const values: Record<string, string> = {};

  for (const field of fields) {
    const raw = value[field.key];

    if (raw === undefined || raw === null) {
      values[field.key] = "";
      continue;
    }

    values[field.key] = typeof raw === "string" ? raw : String(raw);
  }

  for (const [key, raw] of Object.entries(value)) {
    if (fields.some((field) => field.key === key)) {
      continue;
    }

    if (raw === undefined || raw === null) {
      continue;
    }

    values[key] = typeof raw === "string" ? raw : String(raw);
  }

  return values;
}

export function compositeFieldValuesToObject(
  type: string,
  values: Record<string, string>
) {
  const fields = getCompositeFieldsForType(type) ?? [];
  const object: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.key]?.trim();

    if (value) {
      if (field.key === "inset" && value === "false") {
        continue;
      }

      object[field.key] = value;
    }
  }

  for (const [key, value] of Object.entries(values)) {
    if (fields.some((field) => field.key === key)) {
      continue;
    }

    const trimmed = value.trim();

    if (trimmed) {
      object[key] = trimmed;
    }
  }

  return object;
}

export function serializeCompositeFieldValues(
  type: string,
  values: Record<string, string>
) {
  return JSON.stringify(compositeFieldValuesToObject(type, values));
}

export function parseCompositeFieldValues(type: string, rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return createDefaultCompositeFieldValues(type);
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return objectToCompositeFieldValues(type, parsed as Record<string, unknown>);
    }
  } catch {
    return createDefaultCompositeFieldValues(type);
  }

  return createDefaultCompositeFieldValues(type);
}

export function tryParseJsonValue(rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function resolveStoredRawObject(raw?: StoredTokenRawValue) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  return null;
}

export function resolveStoredRawArray(raw?: StoredTokenRawValue) {
  if (Array.isArray(raw)) {
    return raw;
  }

  return null;
}

export function formatScalarPlaceholder(type?: string) {
  switch (type) {
    case "dimension":
      return "16px";
    case "duration":
      return "200ms";
    case "fontFamily":
      return "Inter, sans-serif";
    case "fontWeight":
    case "number":
      return "400";
    case "cubicBezier":
      return "0, 0, 0.2, 1";
    default:
      return undefined;
  }
}
