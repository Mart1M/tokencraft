import { mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TOKENCRAFT_CONFIG_FILENAME } from "@/lib/tokencraft/config";
import { createTokenFile } from "@/lib/tokens/fs";
import {
  deleteWorkspaceCollectionMode,
  ModeOperationError,
  renameWorkspaceCollectionMode,
} from "@/lib/workspaces/mode-operations";

describe("workspace collection mode operations", () => {
  let rootPath: string;

  beforeEach(() => {
    rootPath = mkdtempSync(join(tmpdir(), "tokencraft-mode-test-"));
  });

  afterEach(() => {
    rmSync(rootPath, { recursive: true, force: true });
  });

  async function seedCollectionWithModes() {
    const file = await createTokenFile(rootPath, "tokens/core.tokens.json", "Core");

    await writeFile(
      join(rootPath, "tokens/core.tokens.json"),
      `${JSON.stringify(
        {
          color: {
            primary: {
              $value: {
                Light: "#ffffff",
                Dark: "#111111",
              },
              $type: "color",
            },
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
          collections: [
            {
              name: "Core",
              files: ["tokens/core.tokens.json"],
              modes: ["Light", "Dark"],
            },
          ],
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    return file;
  }

  it("renames a mode in config and token values", async () => {
    const file = await seedCollectionWithModes();

    await renameWorkspaceCollectionMode(rootPath, {
      fileId: file.id,
      oldMode: "Dark",
      newMode: "Night",
      modes: ["Light", "Dark"],
    });

    const tokenJson = JSON.parse(
      await readFile(join(rootPath, "tokens/core.tokens.json"), "utf8")
    );
    const config = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );

    expect(tokenJson.color.primary.$value).toEqual({
      Light: "#ffffff",
      Night: "#111111",
    });
    expect(config.collections[0].modes).toEqual(["Light", "Night"]);
  });

  it("deletes a mode from config and token values", async () => {
    const file = await seedCollectionWithModes();

    await deleteWorkspaceCollectionMode(rootPath, {
      fileId: file.id,
      mode: "Dark",
      modes: ["Light", "Dark"],
    });

    const tokenJson = JSON.parse(
      await readFile(join(rootPath, "tokens/core.tokens.json"), "utf8")
    );
    const config = JSON.parse(
      await readFile(join(rootPath, TOKENCRAFT_CONFIG_FILENAME), "utf8")
    );

    expect(tokenJson.color.primary.$value).toEqual({
      Light: "#ffffff",
    });
    expect(config.collections[0].modes).toEqual(["Light"]);
  });

  it("rejects deleting the last mode", async () => {
    const file = await seedCollectionWithModes();

    await expect(
      deleteWorkspaceCollectionMode(rootPath, {
        fileId: file.id,
        mode: "Light",
        modes: ["Light"],
      })
    ).rejects.toThrow(ModeOperationError);
  });
});
