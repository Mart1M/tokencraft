import { describe, expect, it } from "vitest";

import { getImportedTokenRows } from "@/lib/tokens/entries";
import { collectTokenModes, resolveStoredTokenModes } from "@/lib/tokens/display";

describe("resolveStoredTokenModes", () => {
  it("rebuilds modes from raw multi-mode values", () => {
    const modes = resolveStoredTokenModes({
      value: "light: #fff · dark: #000",
      type: "color",
      raw: {
        light: "#ffffff",
        dark: "#000000",
      },
    });

    expect(modes).toEqual({
      light: { kind: "color", text: "#ffffff", color: "#ffffff" },
      dark: { kind: "color", text: "#000000", color: "#000000" },
    });
  });

  it("hydrates imported rows so mode tabs can render", () => {
    const rows = getImportedTokenRows([
      {
        id: "file-1",
        collectionName: "design",
        path: "tokens/design.json",
        metadata: {
          topLevelKeys: ["color"],
          tokens: [
            {
              path: "color.background",
              type: "color",
              value: "light: #fff · dark: #000",
              display: { kind: "text", text: "light: #fff · dark: #000" },
              raw: {
                light: "#ffffff",
                dark: "#000000",
              },
            },
          ],
        },
      } as never,
    ]);

    expect(collectTokenModes(rows)).toEqual(["light", "dark"]);
    expect(rows[0]?.modes?.light).toEqual({
      kind: "color",
      text: "#ffffff",
      color: "#ffffff",
    });
  });
});
