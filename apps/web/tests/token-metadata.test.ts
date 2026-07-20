import { describe, expect, it } from "vitest";

import { flattenTokenEntries } from "@/lib/tokens/flatten";
import { buildJsonFromMetadata } from "@/lib/tokens/json-patch";
import {
  extensionsToKeyValueItems,
  keyValueItemsToExtensions,
  mergeTokenMetadata,
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

  it("extracts and writes the TokenCraft color modifier without flattening it", () => {
    const entries = flattenTokenEntries({
      color: {
        overlay: {
          $type: "color",
          $value: "{color.base}",
          $extensions: {
            tokencraft: {
              modify: { space: "srgb", type: "alpha", value: "0.05" },
            },
            "com.figma": { styleId: "S:123" },
          },
        },
      },
    });

    expect(entries[0]?.colorModifier).toEqual({
      space: "srgb",
      type: "alpha",
      value: "0.05",
    });
    expect(entries[0]?.extensions).toEqual({ "com.figma.styleId": "S:123" });

    expect(buildJsonFromMetadata({ topLevelKeys: ["color"], tokens: entries })).toEqual({
      color: {
        overlay: {
          $type: "color",
          $value: "{color.base}",
          $extensions: {
            "com.figma.styleId": "S:123",
            tokencraft: {
              modify: { space: "srgb", type: "alpha", value: "0.05" },
            },
          },
        },
      },
    });
  });

  it("extracts the studio.tokens color modifier without flattening it", () => {
    const entries = flattenTokenEntries({
      color: {
        overlay: {
          $type: "color",
          $value: "{color.base}",
          $extensions: {
            "studio.tokens": {
              modify: {
                color: "{vp.semantic.color.container.neutral}",
                space: "srgb",
                type: "mix",
                value: "0.2",
              },
            },
            "com.figma": { styleId: "S:123" },
          },
        },
      },
    });

    expect(entries[0]?.colorModifier).toEqual({
      color: "{vp.semantic.color.container.neutral}",
      space: "srgb",
      type: "mix",
      value: "0.2",
      format: "studio.tokens",
    });
    expect(entries[0]?.extensions).toEqual({ "com.figma.styleId": "S:123" });

    // Round-trip: writes back under "studio.tokens" and strips the internal format marker
    expect(buildJsonFromMetadata({ topLevelKeys: ["color"], tokens: entries })).toEqual({
      color: {
        overlay: {
          $type: "color",
          $value: "{color.base}",
          $extensions: {
            "com.figma.styleId": "S:123",
            "studio.tokens": {
              modify: {
                color: "{vp.semantic.color.container.neutral}",
                space: "srgb",
                type: "mix",
                value: "0.2",
              },
            },
          },
        },
      },
    });
  });

  it("removes a modifier explicitly from a draft", () => {
    const next = mergeTokenMetadata(
      {
        path: "color.overlay",
        type: "color",
        value: "{color.base}",
        colorModifier: { space: "srgb", type: "alpha", value: "0.05" },
      },
      { colorModifier: null },
    );

    expect(next.colorModifier).toBeUndefined();
  });
});
