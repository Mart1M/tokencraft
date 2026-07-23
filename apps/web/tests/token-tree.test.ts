import { describe, expect, it } from "vitest";

import {
  buildTokenTree,
  getTokenGroupSegments,
  splitTokenPath,
  tokenMatchesGroup,
  tokenMatchesSearch,
} from "@/lib/tokens/token-tree";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

function row(name: string, extras?: Partial<ImportedTokenRow>): ImportedTokenRow {
  return {
    id: name,
    fileId: "file-1",
    sourcePath: "tokens/core.tokens.json",
    collectionName: "core",
    name,
    value: "x",
    ...extras,
  };
}

describe("splitTokenPath", () => {
  it("splits only on dots, preserving kebab-case keys", () => {
    expect(splitTokenPath("vp.core.letter-spacing.020")).toEqual([
      "vp",
      "core",
      "letter-spacing",
      "020",
    ]);
    expect(splitTokenPath("color.core.blue-500")).toEqual(["color", "core", "blue-500"]);
    expect(splitTokenPath("color-brand-primary")).toEqual(["color-brand-primary"]);
    expect(splitTokenPath("spacing")).toEqual(["spacing"]);
  });
});

describe("getTokenGroupSegments", () => {
  it("drops the leaf segment", () => {
    expect(getTokenGroupSegments("vp.core.letter-spacing.020")).toEqual([
      "vp",
      "core",
      "letter-spacing",
    ]);
    expect(getTokenGroupSegments("color.core.blue-500")).toEqual(["color", "core"]);
    expect(getTokenGroupSegments("spacing")).toEqual([]);
  });
});

describe("buildTokenTree", () => {
  it("groups tokens by JSON object nesting (dots only)", () => {
    const tokens = [
      row("color.core.blue.500"),
      row("color.core.gray.50"),
      row("vp.core.letter-spacing.020"),
      row("vp.core.letter-spacing.040"),
      row("color-brand-primary"),
      row("spacing"),
    ];

    const tree = buildTokenTree(tokens);
    const colorNode = tree.find((node) => node.label === "color");

    expect(colorNode).toBeDefined();
    expect(colorNode!.tokenCount).toBe(2);

    const coreNode = colorNode!.children.find((node) => node.label === "core");
    expect(coreNode?.tokenCount).toBe(2);

    const vpNode = tree.find((node) => node.label === "vp");
    expect(vpNode?.tokenCount).toBe(2);
    const letterSpacing = vpNode?.children
      .find((node) => node.label === "core")
      ?.children.find((node) => node.label === "letter-spacing");
    expect(letterSpacing?.tokenCount).toBe(2);

    // Flat kebab path has no dots, so it is ungrouped.
    expect(tree.some((node) => node.label === "color-brand-primary")).toBe(false);
    expect(tree.some((node) => node.label === "spacing")).toBe(false);
  });
});

describe("tokenMatchesGroup", () => {
  it("matches tokens by JSON path prefix", () => {
    expect(tokenMatchesGroup(row("color.core.blue.500"), ["color", "core"])).toBe(true);
    expect(tokenMatchesGroup(row("color.core.blue.500"), ["color", "brand"])).toBe(false);
    expect(
      tokenMatchesGroup(row("vp.core.letter-spacing.020"), ["vp", "core", "letter-spacing"]),
    ).toBe(true);
    expect(tokenMatchesGroup(row("color-brand-primary"), ["color", "brand"])).toBe(false);
  });
});

describe("tokenMatchesSearch", () => {
  it("matches path, value, and description", () => {
    expect(tokenMatchesSearch(row("color.conifer.500"), "conifer")).toBe(true);
    expect(tokenMatchesSearch(row("color.blue.500", { value: "#74C76A" }), "74c76a")).toBe(true);
    expect(
      tokenMatchesSearch(row("color.blue.500", { description: "*Deprecated*" }), "deprecated"),
    ).toBe(true);
    expect(tokenMatchesSearch(row("color.blue.500"), "orange")).toBe(false);
  });
});
