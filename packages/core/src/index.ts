export type TokenFormat = "dtcg" | "tokens-studio" | "style-dictionary" | "custom";

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
