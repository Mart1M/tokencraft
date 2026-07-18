import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildCreateDraft, type TokenDraft } from "@/lib/tokens/draft-utils";
import { readWorkspaceTokenFiles, writeWorkspaceTokenDrafts } from "@/lib/tokens/fs";
import { TOKEN_TYPE_OPTIONS } from "@/lib/tokens/token-types";
import { createWorkspaceCollection } from "@/lib/workspaces/collection-operations";

const temporaryWorkspaces: string[] = [];

const VALUES: Record<string, string> = {
  color: "#3366ff",
  dimension: "16px",
  fontFamily: "Inter, sans-serif",
  fontWeight: "400",
  duration: "200ms",
  cubicBezier: "0, 0, 0.2, 1",
  number: "0.5",
  string: "Hello",
  boolean: "true",
  gradient: '[{"color":"#000000","position":0},{"color":"#ffffff","position":1}]',
  typography: '{"fontFamily":"Inter","fontSize":"16px","fontWeight":"400","lineHeight":"24px"}',
  composition: '{"typography":"{typography.body}"}',
  borderRadius: "4px",
  sizing: "16px",
  spacing: "8px",
  opacity: "0.5",
  border: '{"width":"1px","style":"solid","color":"#000000"}',
  shadow: '{"offsetX":"0px","offsetY":"2px","blur":"4px","spread":"0px","color":"#000000"}',
  transition: '{"duration":"200ms","delay":"0ms","timingFunction":"ease"}',
  strokeStyle: '{"dashArray":"4 2","lineCap":"round"}',
  asset: '{"url":"https://example.com/logo.svg","format":"svg"}',
};

async function createEmptyCollection() {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "tokencraft-lifecycle-"));
  temporaryWorkspaces.push(rootPath);
  const collection = await createWorkspaceCollection(rootPath, {
    path: "tokens/lifecycle.tokens.json",
    collectionName: "Lifecycle",
  });
  return { rootPath, collection };
}

afterEach(async () => {
  await Promise.all(temporaryWorkspaces.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("empty collection token lifecycle", () => {
  it("creates, updates and deletes every token type exposed by the UI", async () => {
    const { rootPath, collection } = await createEmptyCollection();
    const createDrafts = TOKEN_TYPE_OPTIONS.map((option) =>
      buildCreateDraft({
        fileId: collection.id,
        path: `test.${option.value}`,
        type: option.value,
        mode: null,
        valueKind: "literal",
        rawValue: VALUES[option.value],
      }),
    );

    await writeWorkspaceTokenDrafts(rootPath, { drafts: createDrafts });
    let [file] = await readWorkspaceTokenFiles(rootPath);

    expect(file.metadata.tokens).toHaveLength(TOKEN_TYPE_OPTIONS.length);
    expect(file.metadata.tokens.map((entry) => entry.type).sort()).toEqual(
      TOKEN_TYPE_OPTIONS.map((option) => option.value).sort(),
    );

    const updateDrafts: TokenDraft[] = file.metadata.tokens.map((entry) => ({
      tokenId: `${file.id}:${entry.path}`,
      fileId: file.id,
      path: entry.path,
      type: entry.type,
      mode: null,
      valueKind: "literal",
      rawValue: entry.type === "color" ? "#ff3366" : VALUES[entry.type ?? "string"],
      operation: "update",
    }));

    await writeWorkspaceTokenDrafts(rootPath, { drafts: updateDrafts });
    [file] = await readWorkspaceTokenFiles(rootPath);
    expect(file.metadata.tokens).toHaveLength(TOKEN_TYPE_OPTIONS.length);
    expect(file.metadata.tokens.find((entry) => entry.path === "test.color")?.value).toBe("#ff3366");

    const deleteDrafts: TokenDraft[] = file.metadata.tokens.map((entry) => ({
      tokenId: `${file.id}:${entry.path}`,
      fileId: file.id,
      path: entry.path,
      type: entry.type,
      mode: null,
      valueKind: "literal",
      rawValue: entry.value,
      operation: "delete",
    }));

    await writeWorkspaceTokenDrafts(rootPath, { drafts: deleteDrafts });
    [file] = await readWorkspaceTokenFiles(rootPath);
    expect(file.metadata.tokens).toHaveLength(0);
  });
});
