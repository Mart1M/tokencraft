import {
  getCompositeFieldsForType,
  isCompositeTokenType,
} from "@/lib/tokens/composite-fields";
import type { StoredTokenRawValue } from "@/lib/tokens/raw-value";

export type CompositionFieldValue = {
  key: string;
  value: string;
};

export function parseCompositionFieldValues(rawValue: string): CompositionFieldValue[] {
  const parsed = tryParseJsonValue(rawValue);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

export function serializeCompositionFieldValues(fields: CompositionFieldValue[]) {
  return JSON.stringify(
    Object.fromEntries(
      fields
        .map((field) => [field.key.trim(), field.value] as const)
        .filter(([key]) => Boolean(key)),
    ),
    null,
    2,
  );
}

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

  if (type === "composition") {
    return "{}";
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
  const source =
    type === "shadow" || type === "boxShadow"
      ? {
          ...value,
          ...(value.offsetX === undefined && value.x !== undefined
            ? { offsetX: value.x }
            : {}),
          ...(value.offsetY === undefined && value.y !== undefined
            ? { offsetY: value.y }
            : {}),
        }
      : value;
  const fields = getCompositeFieldsForType(type) ?? [];
  const values: Record<string, string> = {};

  for (const field of fields) {
    const raw = source[field.key];

    if (raw === undefined || raw === null) {
      values[field.key] = "";
      continue;
    }

    values[field.key] = typeof raw === "string" ? raw : String(raw);
  }

  for (const [key, raw] of Object.entries(source)) {
    if (fields.some((field) => field.key === key) || key === "x" || key === "y" || key === "type") {
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

/** Tokens Studio boxShadow layers use x/y + type; DTCG uses offsetX/offsetY. */
export function serializeShadowLayerObject(
  type: string,
  values: Record<string, string>,
) {
  const object = compositeFieldValuesToObject(type, values);

  if (type !== "boxShadow") {
    return object;
  }

  const next: Record<string, string> = {};
  const inset = object.inset === "true";

  if (object.offsetX !== undefined) next.x = object.offsetX;
  if (object.offsetY !== undefined) next.y = object.offsetY;
  if (object.blur !== undefined) next.blur = object.blur;
  if (object.spread !== undefined) next.spread = object.spread;
  if (object.color !== undefined) next.color = object.color;
  next.type = inset ? "innerShadow" : "dropShadow";

  return next;
}

export function parseShadowLayerValues(type: string, rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return [createDefaultCompositeFieldValues(type)];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return [createDefaultCompositeFieldValues(type)];
      }

      return parsed.map((layer) =>
        layer && typeof layer === "object" && !Array.isArray(layer)
          ? objectToCompositeFieldValues(type, layer as Record<string, unknown>)
          : createDefaultCompositeFieldValues(type),
      );
    }

    if (parsed && typeof parsed === "object") {
      return [objectToCompositeFieldValues(type, parsed as Record<string, unknown>)];
    }
  } catch {
    return [createDefaultCompositeFieldValues(type)];
  }

  return [createDefaultCompositeFieldValues(type)];
}

export function serializeShadowLayerValues(
  type: string,
  layers: Array<Record<string, string>>,
) {
  return JSON.stringify(
    layers.map((layer) => serializeShadowLayerObject(type, layer)),
    null,
    2,
  );
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
