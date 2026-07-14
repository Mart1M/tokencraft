import { describe, expect, it } from "vitest";

import {
  buildJsonFromMetadata,
  ensureTokenAtPath,
  removeTokenAtPath,
} from "@/lib/tokens/json-patch";
import { applyDraftsToMetadata } from "@/lib/workspaces/token-edit-operations";
import type { TokenDraft } from "@/lib/tokens/draft-utils";

describe("json patch helpers", () => {
  it("creates nested token paths with DTCG leaves", () => {
    const root = ensureTokenAtPath({}, "color.primary.500", "color", "#0066FF");

    expect(root).toEqual({
      color: {
        primary: {
          500: {
            $type: "color",
            $value: "#0066FF",
          },
        },
      },
    });
  });

  it("removes token leaves by path", () => {
    const root = ensureTokenAtPath({}, "spacing.4", "dimension", "4px");
    removeTokenAtPath(root, "spacing.4");

    expect(root).toEqual({
      spacing: {},
    });
  });

  it("builds JSON from stored metadata", () => {
    const json = buildJsonFromMetadata({
      topLevelKeys: ["color"],
      tokens: [
        {
          path: "color.brand",
          type: "color",
          value: "#112233",
          display: { kind: "color" as const, text: "#112233", color: "#112233" },
        },
      ],
    });

    expect(json).toEqual({
      color: {
        brand: {
          $type: "color",
          $value: "#112233",
        },
      },
    });
  });
});

describe("applyDraftsToMetadata", () => {
  const baseMetadata = {
    topLevelKeys: ["color"],
    tokens: [
      {
        path: "color.old",
        type: "color",
        value: "#000000",
        display: { kind: "color" as const, text: "#000000", color: "#000000" },
      },
    ],
  };

  it("appends create drafts", () => {
    const draft: TokenDraft = {
      tokenId: "pending:file:color.new",
      fileId: "file",
      path: "color.new",
      type: "color",
      mode: null,
      valueKind: "literal",
      rawValue: "#FFFFFF",
      operation: "create",
    };

    const metadata = applyDraftsToMetadata(baseMetadata, [draft]);

    expect(metadata.tokens.map((entry) => entry.path)).toEqual(["color.old", "color.new"]);
    expect(metadata.topLevelKeys).toEqual(["color"]);
  });

  it("removes delete drafts", () => {
    const draft: TokenDraft = {
      tokenId: "file:color.old",
      fileId: "file",
      path: "color.old",
      type: "color",
      mode: null,
      valueKind: "literal",
      rawValue: "#000000",
      operation: "delete",
    };

    const metadata = applyDraftsToMetadata(baseMetadata, [draft]);

    expect(metadata.tokens).toEqual([]);
  });
});
