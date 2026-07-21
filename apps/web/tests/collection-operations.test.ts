import { mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TOKENCRAFT_CONFIG_FILENAME } from "@/lib/tokencraft/config";
import { createTokenFile, createWorkspaceFolder, getWorkspaceFolderPaths, renameWorkspaceFolder, renameWorkspaceTokenFile, WorkspaceFsError } from "@/lib/tokens/fs";

describe("createTokenFile", () => {
  let rootPath: string;

  beforeEach(() => {
    rootPath = mkdtempSync(join(tmpdir(), "tokencraft-test-"));
  });

  afterEach(() => {
    rmSync(rootPath, { recursive: true, force: true });
  });

  it("creates a new empty token file on disk", async () => {
    const file = await createTokenFile(rootPath, "tokens/brand.json");

    expect(file.path).toBe("tokens/brand.json");
    expect(file.collectionName).toBe("brand");

    const content = await readFile(join(rootPath, "tokens/brand.json"), "utf8");
    expect(content).toBe("{}\n");
  });

  it("rejects a path that already exists", async () => {
    await createTokenFile(rootPath, "tokens/brand.json");

    await expect(createTokenFile(rootPath, "tokens/brand.json")).rejects.toThrow(
      "A collection already exists at this path."
    );
  });

  it("rejects a non-json path", async () => {
    await expect(createTokenFile(rootPath, "tokens/brand")).rejects.toThrow(WorkspaceFsError);
  });

  it("rejects a path that escapes the workspace root", async () => {
    await expect(createTokenFile(rootPath, "../escape.json")).rejects.toThrow(WorkspaceFsError);
  });

  it("accepts a workspace root with a trailing slash (e.g. from a native folder picker)", async () => {
    const file = await createTokenFile(`${rootPath}/`, "tokens/brand.json");

    expect(file.path).toBe("tokens/brand.json");

    const content = await readFile(join(rootPath, "tokens/brand.json"), "utf8");
    expect(content).toBe("{}\n");
  });

  it("bootstraps tokencraft.config.json when the workspace has no config yet and the new file is a plain, empty .json (not *.tokens.json)", async () => {
    const file = await createTokenFile(rootPath, "tokens/core.json");

    expect(file.tokenCount).toBe(0);

    const config = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );

    expect(config.files).toEqual(["tokens/core.json"]);
  });

  it("registers the new file in an existing tokencraft.config.json (plain files list)", async () => {
    await writeFile(
      join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
      `${JSON.stringify({ version: 1, files: ["tokens/existing.tokens.json"] }, null, 2)}\n`,
      "utf8"
    );

    await createTokenFile(rootPath, "tokens/brand.json");

    const config = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );

    expect(config.files).toEqual([
      "tokens/existing.tokens.json",
      "tokens/brand.json",
    ]);
  });

  it("registers the new file in an existing tokencraft.config.json (named collections)", async () => {
    await writeFile(
      join(rootPath, TOKENCRAFT_CONFIG_FILENAME),
      `${JSON.stringify(
        {
          version: 1,
          collections: [{ name: "Core", files: ["tokens/core.json"] }],
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await createTokenFile(rootPath, "tokens/brand.json", "My Set");

    const config = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );

    expect(config.collections).toEqual([
      { name: "Core", files: ["tokens/core.json"] },
      { name: "My Set", files: ["tokens/brand.json"] },
    ]);
  });
});

describe("createWorkspaceFolder", () => {
  let rootPath: string;

  beforeEach(() => {
    rootPath = mkdtempSync(join(tmpdir(), "tokencraft-test-"));
  });

  afterEach(() => {
    rmSync(rootPath, { recursive: true, force: true });
  });

  it("creates and records an empty folder", async () => {
    await createWorkspaceFolder(rootPath, "tokens/semantic");

    expect(await getWorkspaceFolderPaths(rootPath)).toEqual(["tokens/semantic"]);
    expect(JSON.parse(await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8"))).toEqual({
      version: 1,
      files: [],
      folders: ["tokens/semantic"],
    });
  });

  it("rejects paths that escape the workspace root", async () => {
    await expect(createWorkspaceFolder(rootPath, "../escape")).rejects.toThrow(WorkspaceFsError);
  });

  it("renames folders and collection files while keeping the config in sync", async () => {
    await createWorkspaceFolder(rootPath, "tokens");
    await createTokenFile(rootPath, "tokens/core.json");

    await renameWorkspaceFolder(rootPath, "tokens", "design-tokens");
    await renameWorkspaceTokenFile(rootPath, "design-tokens/core.json", "design-tokens/base.json");

    expect(await getWorkspaceFolderPaths(rootPath)).toEqual(["design-tokens"]);
    expect(JSON.parse(await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8"))).toEqual({
      version: 1,
      files: ["design-tokens/base.json"],
      folders: ["design-tokens"],
    });
  });
});
