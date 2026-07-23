import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TOKENCRAFT_CONFIG_FILENAME } from "@/lib/tokencraft/config";
import {
  initWorkspaceConfig,
  readWorkspaceTokenFiles,
  writeWorkspaceTokenDrafts,
} from "@/lib/tokens/fs";
import {
  bindModesToFiles,
  detectSeparateModeGroups,
  mergeSeparateModeFiles,
  splitMetadataForModeFiles,
  suggestModeFilePath,
} from "@/lib/tokens/mode-storage";
import {
  addWorkspaceCollectionMode,
  deleteWorkspaceCollectionMode,
  renameWorkspaceCollectionMode,
} from "@/lib/workspaces/mode-operations";

describe("mode storage helpers", () => {
  it("binds modes to files by index", () => {
    expect(
      bindModesToFiles(["light", "dark"], [
        "tokens/light.tokens.json",
        "tokens/dark.tokens.json",
        "tokens/extra.tokens.json",
      ])
    ).toEqual([
      { mode: "light", path: "tokens/light.tokens.json" },
      { mode: "dark", path: "tokens/dark.tokens.json" },
    ]);
  });

  it("detects sibling files with shared token paths as modes", () => {
    expect(
      detectSeparateModeGroups([
        {
          path: "semantic/legacy/light.json",
          tokenPaths: ["color.bg", "color.fg", "space.1"],
        },
        {
          path: "semantic/legacy/dark.json",
          tokenPaths: ["color.bg", "color.fg", "space.1"],
        },
        {
          path: "component/button/web.json",
          tokenPaths: ["vp.web.button.label"],
        },
        {
          path: "component/button/android.json",
          tokenPaths: ["vp.android.button.label"],
        },
        {
          path: "core/core.json",
          tokenPaths: ["color.blue.500"],
        },
      ])
    ).toEqual([
      {
        collectionName: "semantic / legacy",
        modes: ["light", "dark"],
        paths: ["semantic/legacy/light.json", "semantic/legacy/dark.json"],
      },
    ]);
  });

  it("suggests a sibling mode file path", () => {
    expect(
      suggestModeFilePath(
        { light: "tokens/semantic/light.tokens.json" },
        "Dark"
      )
    ).toBe("tokens/semantic/dark.tokens.json");
  });

  it("merges separate mode files into one collection", () => {
    const merged = mergeSeparateModeFiles({
      collectionName: "Semantic",
      modeStorage: "separate-files",
      modeFiles: [
        {
          mode: "light",
          file: {
            path: "tokens/semantic/light.tokens.json",
            format: "dtcg",
            metadata: {
              topLevelKeys: ["color"],
              tokens: [
                {
                  path: "color.bg",
                  type: "color",
                  value: "#ffffff",
                  raw: "#ffffff",
                  display: { kind: "color", text: "#ffffff", color: "#ffffff" },
                },
              ],
            },
          },
        },
        {
          mode: "dark",
          file: {
            path: "tokens/semantic/dark.tokens.json",
            format: "dtcg",
            metadata: {
              topLevelKeys: ["color"],
              tokens: [
                {
                  path: "color.bg",
                  type: "color",
                  value: "#111111",
                  raw: "#111111",
                  display: { kind: "color", text: "#111111", color: "#111111" },
                },
              ],
            },
          },
        },
      ],
    });

    expect(merged.collectionName).toBe("Semantic");
    expect(merged.configuredModes).toEqual(["light", "dark"]);
    expect(merged.modeFiles).toEqual({
      light: "tokens/semantic/light.tokens.json",
      dark: "tokens/semantic/dark.tokens.json",
    });
    expect(merged.metadata.tokens[0]?.modes).toMatchObject({
      light: expect.objectContaining({ text: "#ffffff" }),
      dark: expect.objectContaining({ text: "#111111" }),
    });
  });

  it("preserves boxShadow layer arrays when merging separate mode files", () => {
    const layer = {
      blur: "0",
      color: "{vp.core.color.white}",
      spread: "4",
      type: "dropShadow",
      x: "0",
      y: "0",
    };

    const merged = mergeSeparateModeFiles({
      collectionName: "Elevation",
      modeStorage: "separate-files",
      modeFiles: [
        {
          mode: "light",
          file: {
            path: "tokens/elevation/light.json",
            format: "custom",
            metadata: {
              topLevelKeys: ["shadow"],
              tokens: [
                {
                  path: "shadow.focus",
                  type: "boxShadow",
                  value: "0 0 0 4 {vp.core.color.white}",
                  raw: [layer],
                  display: {
                    kind: "composite",
                    text: "0 0 0 4 {vp.core.color.white}",
                  },
                },
              ],
            },
          },
        },
        {
          mode: "dark",
          file: {
            path: "tokens/elevation/dark.json",
            format: "custom",
            metadata: {
              topLevelKeys: ["shadow"],
              tokens: [
                {
                  path: "shadow.focus",
                  type: "boxShadow",
                  value: "0 0 0 4 {vp.core.color.black}",
                  raw: [{ ...layer, color: "{vp.core.color.black}" }],
                  display: {
                    kind: "composite",
                    text: "0 0 0 4 {vp.core.color.black}",
                  },
                },
              ],
            },
          },
        },
      ],
    });

    expect(merged.metadata.tokens[0]?.raw).toEqual({
      light: [layer],
      dark: [{ ...layer, color: "{vp.core.color.black}" }],
    });
    expect(merged.metadata.tokens[0]?.modes?.light?.text).toContain(
      "{vp.core.color.white}",
    );
  });

  it("splits merged metadata back into scalar mode files", () => {
    const parts = splitMetadataForModeFiles(
      {
        topLevelKeys: ["color"],
        tokens: [
          {
            path: "color.bg",
            type: "color",
            value: "light / dark",
            raw: { light: "#fff", dark: "#000" },
            modes: {
              light: { kind: "color", text: "#fff", color: "#fff" },
              dark: { kind: "color", text: "#000", color: "#000" },
            },
          },
        ],
      },
      {
        light: "tokens/light.tokens.json",
        dark: "tokens/dark.tokens.json",
      }
    );

    expect(parts).toHaveLength(2);
    expect(parts[0]?.metadata.tokens[0]?.raw).toBe("#fff");
    expect(parts[1]?.metadata.tokens[0]?.raw).toBe("#000");
  });
});

describe("separate-files workspace mode storage", () => {
  let rootPath: string;

  beforeEach(() => {
    rootPath = mkdtempSync(join(tmpdir(), "tokencraft-mode-storage-"));
  });

  afterEach(() => {
    rmSync(rootPath, { recursive: true, force: true });
  });

  async function seedSeparateFilesWorkspace() {
    await mkdir(join(rootPath, "tokens/semantic"), { recursive: true });
    await writeFile(
      join(rootPath, "tokens/semantic/light.tokens.json"),
      `${JSON.stringify(
        {
          color: {
            bg: { $type: "color", $value: "#ffffff" },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(rootPath, "tokens/semantic/dark.tokens.json"),
      `${JSON.stringify(
        {
          color: {
            bg: { $type: "color", $value: "#111111" },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
      `${JSON.stringify(
        {
          version: 1,
          modeStorage: "separate-files",
          collections: [
            {
              name: "Semantic",
              files: [
                "tokens/semantic/light.tokens.json",
                "tokens/semantic/dark.tokens.json",
              ],
              modes: ["light", "dark"],
            },
          ],
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  it("initializes a workspace with separate-files mode storage", async () => {
    const result = await initWorkspaceConfig(rootPath, {
      modeStorage: "separate-files",
    });

    expect(result.created).toBe(true);
    expect(result.modeStorage).toBe("separate-files");

    const config = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );
    expect(config.modeStorage).toBe("separate-files");
  });

  it("does not overwrite an existing modeStorage on init", async () => {
    await initWorkspaceConfig(rootPath, { modeStorage: "separate-files" });
    const second = await initWorkspaceConfig(rootPath, { modeStorage: "value-map" });

    expect(second.created).toBe(false);
    expect(second.modeStorage).toBe("separate-files");
  });

  it("merges separate mode files when reading the workspace", async () => {
    await seedSeparateFilesWorkspace();
    const files = await readWorkspaceTokenFiles(rootPath);

    expect(files).toHaveLength(1);
    expect(files[0]?.collectionName).toBe("Semantic");
    expect(files[0]?.configuredModes).toEqual(["light", "dark"]);
    expect(files[0]?.metadata.tokens[0]?.modes).toMatchObject({
      light: expect.objectContaining({ text: "#ffffff" }),
      dark: expect.objectContaining({ text: "#111111" }),
    });
  });

  it("auto-detects sibling mode files from a flat files list", async () => {
    await mkdir(join(rootPath, "semantic/legacy"), { recursive: true });
    await writeFile(
      join(rootPath, "semantic/legacy/light.json"),
      `${JSON.stringify(
        {
          color: {
            bg: { type: "color", value: "#ffffff" },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(rootPath, "semantic/legacy/dark.json"),
      `${JSON.stringify(
        {
          color: {
            bg: { type: "color", value: "#111111" },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
      `${JSON.stringify(
        {
          version: 1,
          modeStorage: "separate-files",
          files: [
            "semantic/legacy/dark.json",
            "semantic/legacy/light.json",
          ],
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const files = await readWorkspaceTokenFiles(rootPath);

    expect(files).toHaveLength(1);
    expect(files[0]?.collectionName).toBe("semantic / legacy");
    expect(files[0]?.configuredModes).toEqual(["light", "dark"]);
    expect(files[0]?.modeFiles).toEqual({
      light: "semantic/legacy/light.json",
      dark: "semantic/legacy/dark.json",
    });
    expect(files[0]?.metadata.tokens[0]?.modes).toMatchObject({
      light: expect.objectContaining({ text: "#ffffff" }),
      dark: expect.objectContaining({ text: "#111111" }),
    });
  });

  it("writes draft edits back to the matching mode file", async () => {
    await seedSeparateFilesWorkspace();
    const [collection] = await readWorkspaceTokenFiles(rootPath);

    await writeWorkspaceTokenDrafts(rootPath, {
      drafts: [
        {
          tokenId: `${collection.id}:color.bg`,
          fileId: collection.id,
          path: "color.bg",
          type: "color",
          mode: "dark",
          valueKind: "literal",
          rawValue: "#222222",
        },
      ],
    });

    const darkJson = JSON.parse(
      await readFile(join(rootPath, "tokens/semantic/dark.tokens.json"), "utf8")
    );
    const lightJson = JSON.parse(
      await readFile(join(rootPath, "tokens/semantic/light.tokens.json"), "utf8")
    );

    expect(darkJson.color.bg.$value).toBe("#222222");
    expect(lightJson.color.bg.$value).toBe("#ffffff");
  });

  it("adds, renames, and deletes mode files", async () => {
    await seedSeparateFilesWorkspace();
    const [collection] = await readWorkspaceTokenFiles(rootPath);

    await addWorkspaceCollectionMode(rootPath, {
      fileId: collection.id,
      mode: "contrast",
      modes: ["light", "dark"],
    });

    const afterAdd = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );
    expect(afterAdd.collections[0].modes).toEqual(["light", "dark", "contrast"]);
    expect(afterAdd.collections[0].files).toContain(
      "tokens/semantic/contrast.tokens.json"
    );
    expect(
      await readFile(join(rootPath, "tokens/semantic/contrast.tokens.json"), "utf8")
    ).toBe("{}\n");

    const [afterAddCollection] = await readWorkspaceTokenFiles(rootPath);
    await renameWorkspaceCollectionMode(rootPath, {
      fileId: afterAddCollection.id,
      oldMode: "contrast",
      newMode: "high-contrast",
      modes: ["light", "dark", "contrast"],
    });

    const afterRename = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );
    expect(afterRename.collections[0].modes).toEqual([
      "light",
      "dark",
      "high-contrast",
    ]);
    expect(afterRename.collections[0].files).toContain(
      "tokens/semantic/high-contrast.tokens.json"
    );

    const [afterRenameCollection] = await readWorkspaceTokenFiles(rootPath);
    await deleteWorkspaceCollectionMode(rootPath, {
      fileId: afterRenameCollection.id,
      mode: "high-contrast",
      modes: ["light", "dark", "high-contrast"],
    });

    const afterDelete = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );
    expect(afterDelete.collections[0].modes).toEqual(["light", "dark"]);
    expect(afterDelete.collections[0].files).not.toContain(
      "tokens/semantic/high-contrast.tokens.json"
    );
  });
});
