/// <reference types="@figma/plugin-typings" />

import type {
  CollectionSyncStatus,
  FigmaCollectionExport,
  ImportSummary,
  TokenCraftCollection,
  TokenCraftToken,
  ToMain,
  ToUi,
} from "./protocol";
import {
  getCollectionKey,
  getCompositeProperty,
  getFontFamilyCandidates,
  getFigmaVariableType,
  getTokenModeValue,
  parseTokenValue,
  toFigmaVariableName,
} from "./token-utils";

figma.showUI(__html__, { width: 420, height: 640, themeColors: true });

figma.ui.onmessage = async (message: ToMain) => {
  if (message.type === "inspect-collections") {
    await refreshCollectionState(message.tokens, message.collections);
    return;
  }

  if (message.type === "prepare-figma-export") {
    send({
      type: "figma-collection-export",
      export: await buildFigmaCollectionExport(message.figmaCollectionId),
    });
    return;
  }

  if (message.type === "import-tokens") {
    const summary = await importTokens(
      message.tokens,
      message.collections,
      new Set(message.selectedCollectionIds),
    );
    send({ type: "import-complete", summary });
    await refreshCollectionState(message.tokens, message.collections);
  }
};

function send(message: ToUi) {
  figma.ui.postMessage(message);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Figma could not inspect the current file.";
}

function getFallbackStatuses(
  tokens: TokenCraftToken[],
  collections: TokenCraftCollection[],
  detail: string,
): CollectionSyncStatus[] {
  return collections.map((collection) => {
    const collectionTokens = tokens.filter((token) => token.fileId === collection.id);
    return {
      collectionId: collection.id,
      collectionName: collection.name,
      tokenCount: collectionTokens.length,
      unsupportedTokenCount: collectionTokens.filter((token) => !getFigmaVariableType(token.type) && !isCompositeToken(token)).length,
      state: "out-of-sync" as const,
      detail,
    };
  });
}

async function refreshCollectionState(tokens: TokenCraftToken[], collections: TokenCraftCollection[]) {
  try {
    send({ type: "collection-statuses", statuses: await inspectCollections(tokens, collections) });
  } catch (error) {
    const detail = `Could not check Figma: ${getErrorMessage(error)}`;
    console.error(detail);
    // Never strand the UI in “Checking”: synchronization remains available
    // even when Figma refuses a read operation in the current document.
    send({ type: "collection-statuses", statuses: getFallbackStatuses(tokens, collections, detail) });
  }

  try {
    send({ type: "figma-only-collections", collections: await getFigmaOnlyCollections(collections) });
  } catch (error) {
    console.error(`Could not list Figma-only collections: ${getErrorMessage(error)}`);
  }
}

async function getTextStylesForInspection(): Promise<TextStyle[]> {
  // Some Figma desktop builds can delay style enumeration while a document is
  // loading. Variables must still be inspectable in that situation.
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 2_500);
    figma.getLocalTextStylesAsync()
      .then((styles) => {
        clearTimeout(timeout);
        resolve(styles);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        console.error(`Could not inspect text styles: ${getErrorMessage(error)}`);
        resolve([]);
      });
  });
}

async function inspectCollections(
  tokens: TokenCraftToken[],
  sourceCollections: TokenCraftCollection[],
): Promise<CollectionSyncStatus[]> {
  const [figmaCollections, figmaTextStyles] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    getTextStylesForInspection(),
  ]);
  const collectionsByName = new Map(figmaCollections.map((collection) => [getCollectionKey(collection.name), collection]));
  const figmaVariables = await figma.variables.getLocalVariablesAsync();
  const variablesByCollectionAndName = new Map(
    figmaVariables.map((variable) => [`${variable.variableCollectionId}:${variable.name}`, variable]),
  );
  const sourceVariablesByPath = new Map<string, Variable>();

  for (const token of tokens) {
    const figmaCollection = collectionsByName.get(getCollectionKey(token.collectionName));
    if (!figmaCollection || !getFigmaVariableType(token.type)) continue;
    const variable = variablesByCollectionAndName.get(
      `${figmaCollection.id}:${toFigmaVariableName(token.name)}`,
    );
    if (variable) {
      sourceVariablesByPath.set(`${token.fileId}:${token.name}`, variable);
      if (!sourceVariablesByPath.has(token.name)) sourceVariablesByPath.set(token.name, variable);
    }
  }

  return sourceCollections.map((sourceCollection) => {
    const collectionTokens = tokens.filter((token) => token.fileId === sourceCollection.id);
    const unsupportedTokenCount = collectionTokens.filter((token) => !getFigmaVariableType(token.type) && !isCompositeToken(token)).length;
    const figmaCollection = collectionsByName.get(getCollectionKey(sourceCollection.name));

    if (!figmaCollection) {
      return {
        collectionId: sourceCollection.id,
        collectionName: sourceCollection.name,
        tokenCount: collectionTokens.length,
        unsupportedTokenCount,
        state: "not-imported",
        detail: "No Figma Variable collection with this name.",
      };
    }

    const modeIds = new Map(figmaCollection.modes.map((mode) => [mode.name, mode.modeId]));
    let differences = 0;

    for (const token of collectionTokens) {
      const type = getFigmaVariableType(token.type);
      if (!type) {
        if (token.type === "border") {
          differences += inspectBorderToken(token, sourceCollection, figmaCollection, modeIds, variablesByCollectionAndName, sourceVariablesByPath);
        }
        if (token.type === "typography") {
          differences += inspectTypographyToken(token, sourceCollection, figmaTextStyles, tokens);
        }
        continue;
      }

      const variable = variablesByCollectionAndName.get(
        `${figmaCollection.id}:${toFigmaVariableName(token.name)}`,
      );
      if (!variable || variable.resolvedType !== type) {
        differences += 1;
        continue;
      }

      const modeNames = sourceCollection.modes.length ? sourceCollection.modes : ["Default"];
      for (const modeName of modeNames) {
        const modeId = modeIds.get(modeName);
        if (!modeId) {
          differences += 1;
          continue;
        }

        const parsed = parseTokenValue(getTokenModeValue(token, modeName), type);
        if (parsed.kind === "invalid") {
          differences += 1;
          continue;
        }

        const actual = variable.valuesByMode[modeId];
        if (parsed.kind === "alias") {
          const target = sourceVariablesByPath.get(`${token.fileId}:${parsed.path}`)
            ?? sourceVariablesByPath.get(parsed.path);
          if (!target || !isVariableAlias(actual, target.id)) differences += 1;
          continue;
        }

        if (!isEqualVariableValue(actual, parsed.value)) differences += 1;
      }
    }

    return {
      collectionId: sourceCollection.id,
      collectionName: sourceCollection.name,
      tokenCount: collectionTokens.length,
      unsupportedTokenCount,
      state: differences === 0 ? "up-to-date" : "out-of-sync",
      detail: differences === 0
        ? "All supported tokens match Figma."
        : `${differences} token value${differences === 1 ? "" : "s"} need sync.`,
    };
  });
}

function inspectBorderToken(
  token: TokenCraftToken,
  sourceCollection: TokenCraftCollection,
  figmaCollection: VariableCollection,
  modeIds: Map<string, string>,
  variablesByCollectionAndName: Map<string, Variable>,
  sourceVariablesByPath: Map<string, Variable>,
) {
  let differences = 0;
  const fields: Array<{ name: string; aliases: string[]; type: VariableResolvedDataType }> = [
    { name: "width", aliases: ["width", "lineWidth"], type: "FLOAT" },
    { name: "color", aliases: ["color"], type: "COLOR" },
    { name: "style", aliases: ["style", "strokeStyle"], type: "STRING" },
  ];
  const modeNames = sourceCollection.modes.length ? sourceCollection.modes : ["Default"];

  for (const field of fields) {
    const firstValue = getCompositeProperty(token, modeNames[0], ...field.aliases);
    if (firstValue === undefined) continue;
    const variable = variablesByCollectionAndName.get(
      `${figmaCollection.id}:${toFigmaVariableName(token.name)}/${field.name}`,
    );
    if (!variable || variable.resolvedType !== field.type) {
      differences += 1;
      continue;
    }
    for (const modeName of modeNames) {
      const modeId = modeIds.get(modeName);
      const rawValue = getCompositeProperty(token, modeName, ...field.aliases);
      const textValue = typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean"
        ? String(rawValue) : undefined;
      if (!modeId || !textValue) {
        differences += 1;
        continue;
      }
      const parsed = parseTokenValue(textValue, field.type);
      if (parsed.kind === "invalid") {
        differences += 1;
      } else if (parsed.kind === "alias") {
        const target = sourceVariablesByPath.get(`${token.fileId}:${parsed.path}`) ?? sourceVariablesByPath.get(parsed.path);
        if (!target || !isVariableAlias(variable.valuesByMode[modeId], target.id)) differences += 1;
      } else if (!isEqualVariableValue(variable.valuesByMode[modeId], parsed.value)) {
        differences += 1;
      }
    }
  }
  return differences;
}

function inspectTypographyToken(
  token: TokenCraftToken,
  sourceCollection: TokenCraftCollection,
  styles: TextStyle[],
  allTokens: TokenCraftToken[],
) {
  let differences = 0;
  const modeNames = sourceCollection.modes.length ? sourceCollection.modes : ["Default"];
  for (const modeName of modeNames) {
    const styleName = getTextStyleName(sourceCollection, token, modeName);
    const style = styles.find((candidate) => candidate.name === styleName
      && candidate.getPluginData(TOKENCRAFT_KIND_KEY) === "typography"
      && candidate.getPluginData(TOKENCRAFT_COLLECTION_KEY) === token.fileId
      && candidate.getPluginData(TOKENCRAFT_TOKEN_KEY) === token.name
      && candidate.getPluginData(TOKENCRAFT_MODE_KEY) === modeName);
    if (!style) {
      differences += 1;
      continue;
    }
    const family = resolveCompositeText(getCompositeProperty(token, modeName, "fontFamily"), token, modeName, allTokens);
    const size = parseNumericValue(resolveCompositeText(getCompositeProperty(token, modeName, "fontSize"), token, modeName, allTokens));
    const lineHeight = parseLineHeight(resolveCompositeText(getCompositeProperty(token, modeName, "lineHeight"), token, modeName, allTokens));
    const letterSpacing = parseLetterSpacing(resolveCompositeText(getCompositeProperty(token, modeName, "letterSpacing"), token, modeName, allTokens));
    if ((family && !getFontFamilyCandidates(family).some(
      (candidate) => candidate.toLowerCase() === style.fontName.family.toLowerCase(),
    ))
      || (size !== undefined && style.fontSize !== size)
      || (lineHeight && !isEqualTypographyUnit(style.lineHeight, lineHeight))
      || (letterSpacing && !isEqualTypographyUnit(style.letterSpacing, letterSpacing))) {
      differences += 1;
    }
  }
  return differences;
}

function isEqualTypographyUnit(
  actual: { unit: string; value?: number },
  expected: { unit: string; value?: number },
) {
  return actual.unit === expected.unit && actual.value === expected.value;
}

function isVariableAlias(value: VariableValue | undefined, variableId: string) {
  return typeof value === "object" && value !== null && "type" in value
    && value.type === "VARIABLE_ALIAS" && value.id === variableId;
}

function isEqualVariableValue(actual: VariableValue | undefined, expected: unknown) {
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null || !("r" in actual)) return false;
    const expectedColor = expected as RGBA;
    const actualColor = actual as RGBA;
    return actualColor.r === expectedColor.r
      && actualColor.g === expectedColor.g
      && actualColor.b === expectedColor.b
      && (actualColor.a ?? 1) === (expectedColor.a ?? 1);
  }

  return actual === expected;
}

async function getFigmaOnlyCollections(sourceCollections: TokenCraftCollection[]) {
  const sourceNames = new Set(sourceCollections.map((collection) => getCollectionKey(collection.name)));
  const [figmaCollections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
  ]);

  return figmaCollections
    .filter((collection) => !sourceNames.has(getCollectionKey(collection.name)))
    .map((collection) => ({
      id: collection.id,
      name: collection.name,
      variableCount: variables.filter((variable) => variable.variableCollectionId === collection.id).length,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function buildFigmaCollectionExport(figmaCollectionId: string): Promise<FigmaCollectionExport> {
  const [figmaCollections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
  ]);
  const collection = figmaCollections.find((candidate) => candidate.id === figmaCollectionId);
  if (!collection) throw new Error("This Figma Variable collection no longer exists.");

  const variablesById = new Map(variables.map((variable) => [variable.id, variable]));
  const sourceVariables = variables.filter((variable) => variable.variableCollectionId === collection.id);

  return {
    name: collection.name,
    modes: collection.modes.map((mode) => mode.name),
    tokens: sourceVariables.flatMap((variable) => {
      const type = toTokenCraftType(variable.resolvedType);
      if (!type) return [];

      const values: Record<string, string | number | boolean> = {};
      for (const mode of collection.modes) {
        const value = toTokenCraftValue(variable.valuesByMode[mode.modeId], type, variablesById);
        if (value !== undefined) values[mode.name] = value;
      }

      return Object.keys(values).length ? [{ name: variable.name, type, values }] : [];
    }),
  };
}

function toTokenCraftType(type: VariableResolvedDataType): FigmaCollectionExport["tokens"][number]["type"] | null {
  if (type === "COLOR") return "color";
  if (type === "FLOAT") return "number";
  if (type === "BOOLEAN") return "boolean";
  if (type === "STRING") return "string";
  return null;
}

function toTokenCraftValue(
  value: VariableValue | undefined,
  type: FigmaCollectionExport["tokens"][number]["type"],
  variablesById: Map<string, Variable>,
): string | number | boolean | undefined {
  if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
    const target = variablesById.get(value.id);
    return target ? `{${target.name.replaceAll("/", ".")}}` : undefined;
  }
  if (type === "color") {
    if (typeof value !== "object" || value === null || !("r" in value)) return undefined;
    return rgbaToHex(value as RGBA);
  }
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
}

function rgbaToHex(value: RGBA) {
  const channel = (channelValue: number) => Math.round(Math.min(1, Math.max(0, channelValue)) * 255)
    .toString(16)
    .padStart(2, "0");
  const color = `#${channel(value.r)}${channel(value.g)}${channel(value.b)}`;
  return (value.a ?? 1) < 1 ? `${color}${channel(value.a ?? 1)}` : color;
}

const TOKENCRAFT_KIND_KEY = "tokencraft.kind";
const TOKENCRAFT_COLLECTION_KEY = "tokencraft.collection";
const TOKENCRAFT_TOKEN_KEY = "tokencraft.token";
const TOKENCRAFT_MODE_KEY = "tokencraft.mode";
const TOKENCRAFT_FIELD_KEY = "tokencraft.field";

type BorderVariable = {
  token: TokenCraftToken;
  field: "width" | "color" | "style";
  variable: Variable;
};

function isCompositeToken(token: TokenCraftToken) {
  return token.type === "border" || token.type === "typography";
}

function getOrCreateVariable(
  collection: VariableCollection,
  name: string,
  type: VariableResolvedDataType,
  existingByCollectionAndName: Map<string, Variable>,
  summary: ImportSummary,
) {
  const key = `${collection.id}:${name}`;
  const existing = existingByCollectionAndName.get(key);
  // Variable types are immutable. A deliberate synchronization from
  // TokenCraft replaces a local variable with an incompatible type.
  if (existing && existing.resolvedType !== type) {
    existing.remove();
    const replacement = figma.variables.createVariable(name, collection, type);
    existingByCollectionAndName.set(key, replacement);
    summary.updated += 1;
    return replacement;
  }
  if (existing) {
    summary.updated += 1;
    return existing;
  }
  const variable = figma.variables.createVariable(name, collection, type);
  existingByCollectionAndName.set(key, variable);
  summary.created += 1;
  return variable;
}

function setTokenCraftMetadata(
  target: PluginDataMixin,
  kind: "border" | "typography",
  token: TokenCraftToken,
  modeName?: string,
  field?: string,
) {
  target.setPluginData(TOKENCRAFT_KIND_KEY, kind);
  target.setPluginData(TOKENCRAFT_COLLECTION_KEY, token.fileId);
  target.setPluginData(TOKENCRAFT_TOKEN_KEY, token.name);
  target.setPluginData(TOKENCRAFT_MODE_KEY, modeName ?? "");
  target.setPluginData(TOKENCRAFT_FIELD_KEY, field ?? "");
}

function resolveCompositeText(
  value: unknown,
  token: TokenCraftToken,
  modeName: string,
  allTokens: TokenCraftToken[],
) {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return undefined;
  const alias = value.match(/^\{([^{}]+)\}$/);
  if (!alias) return value;
  const target = allTokens.find((candidate) => candidate.fileId === token.fileId && candidate.name === alias[1])
    ?? allTokens.find((candidate) => candidate.name === alias[1]);
  return target ? getTokenModeValue(target, modeName) : undefined;
}

function parseNumericValue(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseLineHeight(value: string | undefined): LineHeight | undefined {
  if (!value || value.trim().toLowerCase() === "auto") return value ? { unit: "AUTO" } : undefined;
  const parsed = parseNumericValue(value);
  if (parsed === undefined) return undefined;
  return { unit: value.trim().endsWith("%") ? "PERCENT" : "PIXELS", value: parsed };
}

function parseLetterSpacing(value: string | undefined): LetterSpacing | undefined {
  const parsed = parseNumericValue(value);
  if (parsed === undefined) return undefined;
  return { unit: value?.trim().endsWith("%") ? "PERCENT" : "PIXELS", value: parsed };
}

function normalizeFontWeight(value: string | undefined) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const labels: Record<number, string> = {
      100: "thin", 200: "extra light", 300: "light", 400: "regular", 500: "medium",
      600: "semi bold", 700: "bold", 800: "extra bold", 900: "black",
    };
    return labels[Math.round(numeric / 100) * 100] ?? String(numeric);
  }
  return value?.toLowerCase().replaceAll("-", " ").trim();
}

function getTextStyleName(collection: TokenCraftCollection, token: TokenCraftToken, modeName: string) {
  const modeNames = collection.modes.length ? collection.modes : ["Default"];
  const suffix = modeNames.length > 1 ? `/${modeName}` : "";
  return `${collection.name}/${toFigmaVariableName(token.name)}${suffix}`;
}

async function importTokens(
  tokens: TokenCraftToken[],
  collections: TokenCraftCollection[],
  selectedCollectionIds: Set<string>,
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, aliased: 0, skipped: [], errors: [] };
  const selectedCollections = collections.filter((collection) => selectedCollectionIds.has(collection.id));
  const selectedTokens = tokens.filter((token) => selectedCollectionIds.has(token.fileId));
  const figmaCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionsByName = new Map(figmaCollections.map((collection) => [getCollectionKey(collection.name), collection]));
  const variableByTokenId = new Map<string, Variable>();
  const variableByPath = new Map<string, Variable>();
  const collectionModes = new Map<string, Map<string, string>>();

  for (const token of selectedTokens) {
    const type = getFigmaVariableType(token.type);
    if (!type && !isCompositeToken(token)) {
      summary.skipped.push({ token: token.name, reason: `Token type “${token.type ?? "unknown"}” has no Figma equivalent.` });
    }
  }

  for (const sourceCollection of selectedCollections) {
    const collectionKey = getCollectionKey(sourceCollection.name);
    let collection = collectionsByName.get(collectionKey);
    if (!collection) {
      collection = figma.variables.createVariableCollection(sourceCollection.name);
      collectionsByName.set(collectionKey, collection);
    }

    const modeNames = sourceCollection.modes.length ? sourceCollection.modes : ["Default"];
    const defaultModeName = modeNames.find((mode) => mode.toLowerCase() === "default") ?? modeNames[0];
    const modeMap = new Map(collection.modes.map((mode) => [mode.name, mode.modeId]));
    const initialMode = collection.modes.find((mode) => mode.modeId === collection.defaultModeId);
    if (initialMode && !modeMap.has(defaultModeName)) {
      collection.renameMode(initialMode.modeId, defaultModeName);
      modeMap.delete(initialMode.name);
      modeMap.set(defaultModeName, initialMode.modeId);
    }
    for (const modeName of modeNames) {
      if (!modeMap.has(modeName)) modeMap.set(modeName, collection.addMode(modeName));
    }
    collectionModes.set(
      sourceCollection.id,
      new Map(modeNames.map((modeName) => [modeName, modeMap.get(modeName)!])),
    );
  }

  const existingVariables = await figma.variables.getLocalVariablesAsync();
  const existingByCollectionAndName = new Map(
    existingVariables.map((variable) => [`${variable.variableCollectionId}:${variable.name}`, variable]),
  );

  // Aliases can point to a token in another collection. Include every already
  // available Figma Variable in the lookup, even when only one collection is
  // being synchronized in this action.
  for (const token of tokens) {
    const type = getFigmaVariableType(token.type);
    const collection = collectionsByName.get(getCollectionKey(token.collectionName));
    if (!type || !collection) continue;
    const variable = existingByCollectionAndName.get(
      `${collection.id}:${toFigmaVariableName(token.name)}`,
    );
    if (!variable || variable.resolvedType !== type) continue;
    variableByPath.set(`${token.fileId}:${token.name}`, variable);
    if (!variableByPath.has(token.name)) variableByPath.set(token.name, variable);
  }

  for (const token of selectedTokens) {
    const type = getFigmaVariableType(token.type);
    if (!type) continue;
    const collection = collectionsByName.get(getCollectionKey(token.collectionName));
    if (!collection) {
      summary.errors.push(`Missing Figma collection for ${token.collectionName}.`);
      continue;
    }
    const name = toFigmaVariableName(token.name);
    const variable = getOrCreateVariable(collection, name, type, existingByCollectionAndName, summary);
    variableByTokenId.set(token.id, variable);
    variableByPath.set(`${token.fileId}:${token.name}`, variable);
    if (!variableByPath.has(token.name)) variableByPath.set(token.name, variable);
  }

  for (const token of selectedTokens) {
    const variable = variableByTokenId.get(token.id);
    const type = getFigmaVariableType(token.type);
    const modes = collectionModes.get(token.fileId);
    if (!variable || !type || !modes) continue;

    for (const [modeName, modeId] of modes) {
      try {
        const parsed = parseTokenValue(getTokenModeValue(token, modeName), type);
        if (parsed.kind === "invalid") {
          summary.skipped.push({ token: token.name, reason: parsed.reason });
          continue;
        }
        if (parsed.kind === "alias") {
          const target = variableByPath.get(`${token.fileId}:${parsed.path}`) ?? variableByPath.get(parsed.path);
          if (!target) {
            summary.skipped.push({ token: token.name, reason: `Alias target “${parsed.path}” was not imported.` });
            continue;
          }
          if (target.resolvedType !== variable.resolvedType) {
            summary.skipped.push({ token: token.name, reason: `Alias target “${parsed.path}” has an incompatible type.` });
            continue;
          }
          variable.setValueForMode(modeId, figma.variables.createVariableAlias(target));
          summary.aliased += 1;
          continue;
        }
        variable.setValueForMode(modeId, parsed.value);
      } catch (error) {
        summary.errors.push(`${token.name} (${modeName}): ${error instanceof Error ? error.message : "Could not set value."}`);
      }
    }
  }

  const borderVariables: BorderVariable[] = [];
  for (const token of selectedTokens.filter((candidate) => candidate.type === "border")) {
    const collection = collectionsByName.get(getCollectionKey(token.collectionName));
    const sourceCollection = selectedCollections.find((candidate) => candidate.id === token.fileId);
    if (!collection) {
      summary.errors.push(`Missing Figma collection for ${token.collectionName}.`);
      continue;
    }
    if (!sourceCollection) continue;
    const sourceModeNames = sourceCollection.modes.length ? sourceCollection.modes : ["Default"];
    const fields: Array<{ field: BorderVariable["field"]; names: string[]; type: VariableResolvedDataType }> = [
      { field: "width", names: ["width", "lineWidth"], type: "FLOAT" },
      { field: "color", names: ["color"], type: "COLOR" },
      { field: "style", names: ["style", "strokeStyle"], type: "STRING" },
    ];

    for (const definition of fields) {
      const fieldValue = getCompositeProperty(token, sourceModeNames[0], ...definition.names);
      if (fieldValue === undefined) continue;
      const variable = getOrCreateVariable(
        collection,
        `${toFigmaVariableName(token.name)}/${definition.field}`,
        definition.type,
        existingByCollectionAndName,
        summary,
      );
      setTokenCraftMetadata(variable, "border", token, undefined, definition.field);
      borderVariables.push({ token, field: definition.field, variable });
      variableByPath.set(`${token.fileId}:${token.name}.${definition.field}`, variable);
    }
  }

  for (const entry of borderVariables) {
    const modes = collectionModes.get(entry.token.fileId);
    if (!modes) continue;
    const names = entry.field === "width" ? ["width", "lineWidth"]
      : entry.field === "style" ? ["style", "strokeStyle"]
        : ["color"];
    for (const [modeName, modeId] of modes) {
      const rawValue = getCompositeProperty(entry.token, modeName, ...names);
      const textValue = resolveCompositeText(rawValue, entry.token, modeName, tokens);
      const parsed = textValue ? parseTokenValue(textValue, entry.variable.resolvedType) : { kind: "invalid" as const, reason: `Missing ${entry.field} value.` };
      if (parsed.kind === "invalid") {
        summary.skipped.push({ token: entry.token.name, reason: `${entry.field}: ${parsed.reason}` });
        continue;
      }
      try {
        if (parsed.kind === "alias") {
          const target = variableByPath.get(`${entry.token.fileId}:${parsed.path}`) ?? variableByPath.get(parsed.path);
          if (!target || target.resolvedType !== entry.variable.resolvedType) {
            summary.skipped.push({ token: entry.token.name, reason: `${entry.field}: alias “${parsed.path}” is unavailable or incompatible.` });
            continue;
          }
          entry.variable.setValueForMode(modeId, figma.variables.createVariableAlias(target));
          summary.aliased += 1;
        } else {
          entry.variable.setValueForMode(modeId, parsed.value);
        }
      } catch (error) {
        summary.errors.push(`${entry.token.name}.${entry.field} (${modeName}): ${error instanceof Error ? error.message : "Could not set value."}`);
      }
    }
  }

  await importTypographyStyles(selectedTokens, selectedCollections, tokens, summary);

  return summary;
}

async function importTypographyStyles(
  selectedTokens: TokenCraftToken[],
  selectedCollections: TokenCraftCollection[],
  allTokens: TokenCraftToken[],
  summary: ImportSummary,
) {
  const typographyTokens = selectedTokens.filter((token) => token.type === "typography");
  if (!typographyTokens.length) return;

  const [existingStyles, availableFonts] = await Promise.all([
    figma.getLocalTextStylesAsync(),
    figma.listAvailableFontsAsync(),
  ]);
  const stylesByName = new Map(existingStyles.map((style) => [style.name, style]));
  const collectionsById = new Map(selectedCollections.map((collection) => [collection.id, collection]));

  for (const token of typographyTokens) {
    const sourceCollection = collectionsById.get(token.fileId);
    if (!sourceCollection) continue;
    const modeNames = sourceCollection.modes.length ? sourceCollection.modes : ["Default"];

    for (const modeName of modeNames) {
      const fontFamily = resolveCompositeText(
        getCompositeProperty(token, modeName, "fontFamily"), token, modeName, allTokens,
      );
      if (!fontFamily) {
        summary.skipped.push({ token: token.name, reason: "Typography style has no font family." });
        continue;
      }
      const fontWeight = resolveCompositeText(
        getCompositeProperty(token, modeName, "fontWeight"), token, modeName, allTokens,
      );
      const familyFonts = getFontFamilyCandidates(fontFamily).flatMap((family) =>
        availableFonts.filter((font) => font.fontName.family.toLowerCase() === family.toLowerCase()),
      );
      const requestedWeight = normalizeFontWeight(fontWeight);
      const font = familyFonts.find((candidate) => candidate.fontName.style.toLowerCase() === requestedWeight)
        ?? familyFonts.find((candidate) => candidate.fontName.style.toLowerCase().includes(requestedWeight ?? "regular"))
        ?? familyFonts.find((candidate) => candidate.fontName.style.toLowerCase() === "regular")
        ?? familyFonts[0];
      if (!font) {
        summary.skipped.push({ token: token.name, reason: `Font “${fontFamily}” is not available in Figma.` });
        continue;
      }

      const styleName = getTextStyleName(sourceCollection, token, modeName);
      const existing = stylesByName.get(styleName);
      const style = existing ?? figma.createTextStyle();
      if (existing) summary.updated += 1;
      else {
        style.name = styleName;
        stylesByName.set(styleName, style);
        summary.created += 1;
      }

      try {
        await figma.loadFontAsync(font.fontName);
        style.fontName = font.fontName;
        const fontSize = parseNumericValue(resolveCompositeText(
          getCompositeProperty(token, modeName, "fontSize"), token, modeName, allTokens,
        ));
        if (fontSize !== undefined) style.fontSize = fontSize;
        const lineHeight = parseLineHeight(resolveCompositeText(
          getCompositeProperty(token, modeName, "lineHeight"), token, modeName, allTokens,
        ));
        if (lineHeight) style.lineHeight = lineHeight;
        const letterSpacing = parseLetterSpacing(resolveCompositeText(
          getCompositeProperty(token, modeName, "letterSpacing"), token, modeName, allTokens,
        ));
        if (letterSpacing) style.letterSpacing = letterSpacing;
        setTokenCraftMetadata(style, "typography", token, modeName);
      } catch (error) {
        summary.errors.push(`${token.name} (${modeName}): ${error instanceof Error ? error.message : "Could not create text style."}`);
      }
    }
  }
}
