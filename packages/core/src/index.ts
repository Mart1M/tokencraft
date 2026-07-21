export type TokenFormat = "dtcg" | "tokens-studio" | "style-dictionary" | "custom";

/** How mode values are stored on disk for a workspace. */
export type ModeStorage = "value-map" | "separate-files";

export const TOKENCRAFT_CONFIG_FILENAME = "tokencraft.config.json";

export interface TokencraftConfigFile {
  version: 1;
  files: string[];
  /**
   * `value-map` (default): modes live in the same JSON file under `$value`/`value`.
   * `separate-files`: each mode is its own token file within a collection.
   */
  modeStorage?: ModeStorage;
}

/** A workspace backed by a local folder on disk, persisted client-side in localStorage. */
export interface LocalWorkspace {
  id: string;
  name: string;
  slug: string;
  rootPath: string;
  createdAt: string;
}
