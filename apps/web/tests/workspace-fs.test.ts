import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TOKENCRAFT_CONFIG_FILENAME } from "@/lib/tokencraft/config";
import { getTokenSidebarCollections } from "@/lib/tokens/entries";
import {
  discoverWorkspaceConfig,
  ensureTokencraftConfig,
  readWorkspaceTokenFiles,
} from "@/lib/tokens/fs";

const tempDirs: string[] = [];

async function createTempWorkspace(contents: Record<string, unknown>) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tokencraft-workspace-"));
  tempDirs.push(tempDir);

  for (const [relativePath, value] of Object.entries(contents)) {
    const absolutePath = path.join(tempDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    if (typeof value === "string") {
      await fs.writeFile(absolutePath, value, "utf8");
    } else {
      await fs.writeFile(
        absolutePath,
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8"
      );
    }
  }

  return tempDir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true }))
  );
});

describe("ensureTokencraftConfig", () => {
  it("creates tokencraft.config.json from tokenflow.config.json", async () => {
    const workspace = await createTempWorkspace({
      "tokenflow.config.json": {
        collections: [
          {
            name: "Semantic",
            files: ["tokens/Semantic.json"],
            modes: ["Light", "Dark"],
          },
          {
            name: "Core",
            files: ["tokens/Core.json"],
            modes: ["Value"],
          },
        ],
      },
      "tokens/Semantic.json": {
        surface: {
          info: {
            $type: "color",
            $value: { Light: "#000000", Dark: "#ffffff" },
          },
        },
      },
      "tokens/Core.json": {
        color: {
          primary: {
            $type: "color",
            $value: { Value: "#ff0000" },
          },
        },
      },
    });

    const created = await ensureTokencraftConfig(workspace);

    expect(created).toBe(true);

    const config = JSON.parse(
      await fs.readFile(path.join(workspace, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );

    expect(config).toEqual({
      version: 1,
      collections: [
        {
          name: "Core",
          files: ["tokens/Core.json"],
          modes: ["Value"],
        },
        {
          name: "Semantic",
          files: ["tokens/Semantic.json"],
          modes: ["Light", "Dark"],
        },
      ],
    });
  });

  it("creates tokencraft.config.json from generic token json files", async () => {
    const workspace = await createTempWorkspace({
      "tokens/brand.json": {
        color: {
          primary: {
            $type: "color",
            $value: "#3366ff",
          },
        },
      },
      "package.json": {
        name: "design-system",
      },
    });

    const created = await ensureTokencraftConfig(workspace);

    expect(created).toBe(true);

    const config = JSON.parse(
      await fs.readFile(path.join(workspace, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );

    expect(config).toEqual({
      version: 1,
      files: ["tokens/brand.json"],
    });
  });

  it("does not overwrite an existing tokencraft.config.json", async () => {
    const workspace = await createTempWorkspace({
      "tokencraft.config.json": {
        version: 1,
        files: ["tokens/existing.tokens.json"],
      },
      "tokenflow.config.json": {
        collections: [
          {
            name: "Ignored",
            files: ["tokens/other.json"],
          },
        ],
      },
      "tokens/existing.tokens.json": {
        color: { primary: { $type: "color", $value: "#111111" } },
      },
      "tokens/other.json": {
        color: { secondary: { $type: "color", $value: "#222222" } },
      },
    });

    const created = await ensureTokencraftConfig(workspace);

    expect(created).toBe(false);

    const files = await readWorkspaceTokenFiles(workspace);

    expect(files.map((file) => file.path)).toEqual(["tokens/existing.tokens.json"]);
  });
});

describe("readWorkspaceTokenFiles", () => {
  it("bootstraps and loads collections from a foreign workspace", async () => {
    const workspace = await createTempWorkspace({
      "tokenflow.config.json": {
        collections: [
          {
            name: "Semantic",
            files: ["tokens/Semantic.json"],
            modes: ["Light", "Dark"],
          },
        ],
      },
      "tokens/Semantic.json": {
        surface: {
          info: {
            $type: "color",
            $value: { Light: "#000000", Dark: "#ffffff" },
          },
        },
      },
    });

    const files = await readWorkspaceTokenFiles(workspace);
    const collections = getTokenSidebarCollections(files);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: "tokens/Semantic.json",
      collectionName: "Semantic",
      configuredModes: ["Light", "Dark"],
    });
    expect(collections[0]).toMatchObject({
      name: "Semantic",
      modes: ["Light", "Dark"],
    });
  });
});

describe("discoverWorkspaceConfig", () => {
  it("prefers foreign tool config over loose json files", async () => {
    const workspace = await createTempWorkspace({
      "tokenflow.config.json": {
        collections: [
          {
            name: "Configured",
            files: ["tokens/configured.json"],
          },
        ],
      },
      "tokens/configured.json": {
        color: { primary: { $type: "color", $value: "#111111" } },
      },
      "tokens/unconfigured.json": {
        color: { secondary: { $type: "color", $value: "#222222" } },
      },
    });

    const discovered = await discoverWorkspaceConfig(workspace);

    expect(discovered).toEqual({
      version: 1,
      files: ["tokens/configured.json"],
      fileCollections: {
        "tokens/configured.json": {
          name: "Configured",
        },
      },
    });
  });
});
