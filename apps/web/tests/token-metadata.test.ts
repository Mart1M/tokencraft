import { describe, expect, it } from "vitest";

import { flattenTokenEntries } from "@/lib/tokens/flatten";
import { buildJsonFromMetadata } from "@/lib/tokens/json-patch";
import {
  extensionsToKeyValueItems,
  keyValueItemsToExtensions,
  parseDtcgExtensions,
} from "@/lib/tokens/token-metadata";

describe("token metadata", () => {
  it("flattens DTCG description and extensions from token leaves", () => {
    const entries = flattenTokenEntries({
      color: {
        brand: {
          $type: "color",
          $value: "#112233",
          $description: "Primary brand color",
          $extensions: {
            "com.figma": {
              styleId: "S:123",
            },
            deprecated: "false",
          },
        },
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.description).toBe("Primary brand color");
    expect(entries[0]?.extensions).toEqual({
      "com.figma.styleId": "S:123",
      deprecated: "false",
    });
  });

  it("writes description and extensions back to DTCG JSON", () => {
    const json = buildJsonFromMetadata({
      topLevelKeys: ["color"],
      tokens: [
        {
          path: "color.brand",
          type: "color",
          value: "#112233",
          description: "Primary brand color",
          extensions: {
            "com.figma.styleId": "S:123",
          },
          display: { kind: "color", text: "#112233", color: "#112233" },
        },
      ],
    });

    expect(json).toEqual({
      color: {
        brand: {
          $type: "color",
          $value: "#112233",
          $description: "Primary brand color",
          $extensions: {
            "com.figma.styleId": "S:123",
          },
        },
      },
    });
  });

  it("converts extensions to key-value items and back", () => {
    const items = extensionsToKeyValueItems({
      figmaId: "abc",
      deprecated: "true",
    });

    expect(keyValueItemsToExtensions(items)).toEqual({
      figmaId: "abc",
      deprecated: "true",
    });
  });

  it("parses flat extension objects", () => {
    expect(parseDtcgExtensions({ figmaId: "abc" })).toEqual({ figmaId: "abc" });
  });
});
