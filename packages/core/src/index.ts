export type TokenFormat = "dtcg" | "tokens-studio" | "style-dictionary" | "custom";

export interface TokenCollection {
  id: string;
  name: string;
  sourcePaths: string[];
  format: TokenFormat;
}

export interface TokenMode {
  id: string;
  name: string;
  collectionId: string;
}

export interface TokenReference {
  name: string;
  collectionId: string;
  modeId: string;
  aliasTo?: string;
}

export interface WorkspaceConfig {
  adapter: TokenFormat;
  sources: Array<{
    name: string;
    path: string;
  }>;
}

export const TOKENCRAFT_CONFIG_FILENAME = "tokencraft.config.json";

export interface TokencraftConfigFile {
  version: 1;
  files: string[];
}

/** A workspace backed by a local folder on disk, persisted client-side in localStorage. */
export interface LocalWorkspace {
  id: string;
  name: string;
  slug: string;
  rootPath: string;
  createdAt: string;
}
