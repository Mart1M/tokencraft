import { describe, expect, it } from "vitest";

import { resolveColorModifierPreview } from "@/lib/tokens/color-modifier-preview";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

function color(name: string, value: string, colorModifier?: ImportedTokenRow["colorModifier"]): ImportedTokenRow {
  return {
    id: name,
    fileId: "tokens",
    sourcePath: "tokens.json",
    collectionName: "Tokens",
    name,
    type: "color",
    value,
    display: value.startsWith("{")
      ? { kind: "alias", text: value, aliasPath: value.slice(1, -1) }
      : { kind: "color", text: value, color: value },
    ...(colorModifier ? { colorModifier } : {}),
  };
}

describe("color modifier preview", () => {
  it("resolves an alpha modifier from a color reference", () => {
    const base = color("color.base", "#112233");
    const overlay = color("color.overlay", "{color.base}", {
      type: "alpha",
      space: "srgb",
      value: "0.05",
    });

    expect(resolveColorModifierPreview([base, overlay], overlay, "Default").color).toBe("#1122330d");
  });

  it("resolves an alpha modifier from a literal base color", () => {
    const overlay = color("color.overlay", "#112233", {
      type: "alpha",
      space: "srgb",
      value: "0.05",
    });

    expect(resolveColorModifierPreview([overlay], overlay, "Default").color).toBe("#1122330d");
  });

  it("resolves numeric references and literal mix colors", () => {
    const amount: ImportedTokenRow = {
      ...color("opacity.half", "0.5"),
      type: "number",
      display: { kind: "text", text: "0.5" },
    };
    const base = color("color.base", "#000000");
    const target = color("color.target", "{color.base}", {
      type: "mix",
      space: "srgb",
      value: "{opacity.half}",
      color: "#ffffff",
    });

    expect(resolveColorModifierPreview([amount, base, target], target, "Default").color).toBe("#808080");
  });

  it("reports unresolved cycles", () => {
    const first = color("color.first", "{color.second}");
    const second = color("color.second", "{color.first}", {
      type: "alpha",
      space: "srgb",
      value: "0.5",
    });

    expect(resolveColorModifierPreview([first, second], second, "Default")).toEqual({
      error: "Unable to resolve this color modifier.",
    });
  });
});
