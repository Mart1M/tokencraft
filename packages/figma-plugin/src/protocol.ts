export type TokenDisplayValue = {
  kind?: string;
  text?: string;
  aliasPath?: string;
};

export type TokenCraftToken = {
  id: string;
  fileId: string;
  collectionName: string;
  name: string;
  type?: string;
  value: string;
  raw?: unknown;
  display?: TokenDisplayValue;
  modes?: Record<string, TokenDisplayValue>;
};

export type TokenCraftCollection = {
  id: string;
  name: string;
  modes: string[];
  path: string;
};

export type TokenCraftWorkspace = {
  rootPath: string;
  tokens: TokenCraftToken[];
  collections: TokenCraftCollection[];
};

export type ImportSummary = {
  created: number;
  updated: number;
  aliased: number;
  skipped: Array<{ token: string; reason: string }>;
  errors: string[];
};

export type CollectionSyncStatus = {
  collectionId: string;
  collectionName: string;
  tokenCount: number;
  unsupportedTokenCount: number;
  state: "not-imported" | "out-of-sync" | "up-to-date";
  detail: string;
};

export type FigmaOnlyCollection = {
  id: string;
  name: string;
  variableCount: number;
};

export type FigmaCollectionExport = {
  name: string;
  modes: string[];
  tokens: Array<{
    name: string;
    type: "color" | "number" | "boolean" | "string";
    values: Record<string, string | number | boolean>;
  }>;
};

export type ToMain =
  | {
      type: "inspect-collections";
      tokens: TokenCraftToken[];
      collections: TokenCraftCollection[];
    }
  | { type: "prepare-figma-export"; figmaCollectionId: string }
  | {
      type: "import-tokens";
      tokens: TokenCraftToken[];
      collections: TokenCraftCollection[];
      selectedCollectionIds: string[];
    };

export type ToUi =
  | { type: "import-complete"; summary: ImportSummary }
  | { type: "collection-statuses"; statuses: CollectionSyncStatus[] }
  | { type: "figma-only-collections"; collections: FigmaOnlyCollection[] }
  | { type: "figma-collection-export"; export: FigmaCollectionExport };
