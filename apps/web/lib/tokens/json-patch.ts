import type { TokenFileMetadata } from "@/lib/tokens/flatten";
import { entryToRawValue } from "@/lib/tokens/serialize";
import type { TokenExtensions } from "@/lib/tokens/token-metadata";

const ALIAS_PATTERN = /^\{([^}]+)\}$/;

export function normalizeAliasInput(value: string) {
  const trimmed = value.trim();

  if (ALIAS_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return `{${trimmed.replace(/^\{|\}$/g, "")}}`;
}

export function stripAliasBraces(value: string) {
  return value.trim().replace(/^\{|\}$/g, "");
}

export function coerceJsonValue(rawValue: string, type?: string) {
  const trimmed = rawValue.trim();

  if (ALIAS_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (type === "number" || type === "fontWeight") {
    const parsed = Number(trimmed);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function getTokenLeaf(root: unknown, tokenPath: string) {
  const keys = tokenPath.split(".");
  let current: unknown = root;

  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function setTokenLeafValue(
  leaf: Record<string, unknown>,
  rawValue: string,
  type?: string,
  mode?: string | null
) {
  const parsedValue = coerceJsonValue(rawValue, type);
  const valueKey = "$value" in leaf ? "$value" : "value" in leaf ? "value" : null;

  if (!valueKey) {
    throw new Error("Token leaf does not contain a value field.");
  }

  const currentValue = leaf[valueKey];

  if (
    mode &&
    currentValue &&
    typeof currentValue === "object" &&
    !Array.isArray(currentValue)
  ) {
    (currentValue as Record<string, unknown>)[mode] = parsedValue;
    return;
  }

  leaf[valueKey] = parsedValue;
}

export function setTokenAtPath(
  root: Record<string, unknown>,
  tokenPath: string,
  rawValue: unknown,
  type?: string,
  mode?: string | null
) {
  const keys = tokenPath.split(".");
  let current: unknown = root;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      throw new Error(`Token path "${tokenPath}" not found.`);
    }

    current = (current as Record<string, unknown>)[key];
  }

  const leafKey = keys.at(-1);

  if (
    !leafKey ||
    !current ||
    typeof current !== "object" ||
    Array.isArray(current)
  ) {
    throw new Error(`Token path "${tokenPath}" not found.`);
  }

  const leaf = (current as Record<string, unknown>)[leafKey];

  if (!leaf || typeof leaf !== "object" || Array.isArray(leaf)) {
    throw new Error(`Token path "${tokenPath}" not found.`);
  }

  const record = leaf as Record<string, unknown>;
  const valueKey = "$value" in record ? "$value" : "value" in record ? "value" : null;

  if (!valueKey) {
    throw new Error("Token leaf does not contain a value field.");
  }

  if (
    mode &&
    record[valueKey] &&
    typeof record[valueKey] === "object" &&
    !Array.isArray(record[valueKey])
  ) {
    const parsedValue =
      typeof rawValue === "string" ? coerceJsonValue(rawValue, type) : rawValue;
    (record[valueKey] as Record<string, unknown>)[mode] = parsedValue;
    return root;
  }

  if (
    rawValue &&
    typeof rawValue === "object" &&
    !Array.isArray(rawValue)
  ) {
    record[valueKey] = rawValue;
    return root;
  }

  setTokenLeafValue(record, String(rawValue), type, mode);
  return root;
}

export function readTokenRawValue(
  root: Record<string, unknown>,
  tokenPath: string,
  mode?: string | null
) {
  const leaf = getTokenLeaf(root, tokenPath);

  if (!leaf || typeof leaf !== "object" || Array.isArray(leaf)) {
    return null;
  }

  const record = leaf as Record<string, unknown>;
  const valueKey = "$value" in record ? "$value" : "value" in record ? "value" : null;

  if (!valueKey) {
    return null;
  }

  const value = record[valueKey];

  if (mode && value && typeof value === "object" && !Array.isArray(value)) {
    const modeValue = (value as Record<string, unknown>)[mode];
    return typeof modeValue === "string" ? modeValue : JSON.stringify(modeValue);
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function ensureObjectAtPath(
  root: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  let current: Record<string, unknown> = root;

  for (const key of keys) {
    const next = current[key];

    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  return current;
}

export function ensureTokenAtPath(
  root: Record<string, unknown>,
  tokenPath: string,
  type?: string,
  rawValue?: unknown
) {
  const keys = tokenPath.split(".");
  const leafKey = keys.at(-1);

  if (!leafKey) {
    throw new Error(`Invalid token path "${tokenPath}".`);
  }

  const parent = ensureObjectAtPath(root, keys.slice(0, -1));
  const existing = parent[leafKey];

  if (
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    ("$value" in existing || "value" in existing)
  ) {
    if (rawValue !== undefined) {
      setTokenAtPath(root, tokenPath, rawValue, type);
    }

    return root;
  }

  const leaf: Record<string, unknown> = {
    $value:
      rawValue !== undefined
        ? typeof rawValue === "string"
          ? coerceJsonValue(rawValue, type)
          : rawValue
        : "",
  };

  if (type) {
    leaf.$type = type;
  }

  parent[leafKey] = leaf;
  return root;
}

export function removeTokenAtPath(root: Record<string, unknown>, tokenPath: string) {
  const keys = tokenPath.split(".");
  const leafKey = keys.at(-1);

  if (!leafKey) {
    return root;
  }

  let current: unknown = root;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return root;
    }

    current = (current as Record<string, unknown>)[key];
  }

  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return root;
  }

  delete (current as Record<string, unknown>)[leafKey];
  return root;
}

export function applyTokenMetadataToLeaf(
  root: Record<string, unknown>,
  tokenPath: string,
  metadata: { description?: string; extensions?: TokenExtensions }
) {
  const leaf = getTokenLeaf(root, tokenPath);

  if (!leaf || typeof leaf !== "object" || Array.isArray(leaf)) {
    return root;
  }

  const record = leaf as Record<string, unknown>;
  const description = metadata.description?.trim();

  if (description) {
    record.$description = description;
  } else {
    delete record.$description;
  }

  if (metadata.extensions && Object.keys(metadata.extensions).length > 0) {
    record.$extensions = metadata.extensions;
  } else {
    delete record.$extensions;
  }

  return root;
}

export function buildJsonFromMetadata(metadata: TokenFileMetadata) {
  const root: Record<string, unknown> = {};

  for (const key of metadata.topLevelKeys) {
    root[key] = {};
  }

  for (const entry of metadata.tokens) {
    ensureTokenAtPath(root, entry.path, entry.type, entryToRawValue(entry));
    applyTokenMetadataToLeaf(root, entry.path, {
      ...(entry.description ? { description: entry.description } : {}),
      ...(entry.extensions ? { extensions: entry.extensions } : {}),
    });
  }

  return root;
}
