import { describe, expect, it } from "vitest";

import { buildTokensFromJsonDocuments } from "@/lib/tokens/collection-json-preview";

describe("buildTokensFromJsonDocuments", () => {
  it("parses a value-map document into token rows", () => {
    const result = buildTokensFromJsonDocuments({
      fileId: "file-1",
      collectionName: "Colors",
      sourcePath: "colors.json",
      documents: [
        {
          mode: null,
          path: "colors.json",
          content: JSON.stringify({
            color: {
              brand: {
                $type: "color",
                $value: "#ff0000",
              },
            },
          }),
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]?.name).toBe("color.brand");
    expect(result.tokens[0]?.display?.text).toBe("#ff0000");
  });

  it("merges separate mode documents", () => {
    const result = buildTokensFromJsonDocuments({
      fileId: "file-2",
      collectionName: "Legacy",
      sourcePath: "semantic/legacy",
      documents: [
        {
          mode: "light",
          path: "semantic/legacy/light.json",
          content: JSON.stringify({
            bg: { $type: "color", $value: "#fff" },
          }),
        },
        {
          mode: "dark",
          path: "semantic/legacy/dark.json",
          content: JSON.stringify({
            bg: { $type: "color", $value: "#000" },
          }),
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]?.modes?.light?.text).toBe("#fff");
    expect(result.tokens[0]?.modes?.dark?.text).toBe("#000");
  });

  it("returns an error for invalid JSON", () => {
    const result = buildTokensFromJsonDocuments({
      fileId: "file-3",
      collectionName: "Broken",
      sourcePath: "broken.json",
      documents: [{ mode: null, path: "broken.json", content: "{nope" }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Invalid JSON/);
  });
});
