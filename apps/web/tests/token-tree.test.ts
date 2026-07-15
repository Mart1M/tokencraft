import { describe, expect, it } from "vitest";

import {
  buildTokenTree,
  getTokenGroupSegments,
  splitTokenPath,
  tokenMatchesGroup,
} from "@/lib/tokens/token-tree";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

function row(name: string): ImportedTokenRow {
  return {
    id: name,
    fileId: "file-1",
    sourcePath: "tokens/core.tokens.json",
    collectionName: "core",
    name,
    value: "x",
  };
}

describe("splitTokenPath", () => {
  it("splits on both dots and dashes", () => {
    expect(splitTokenPath("color.core.blue-500")).toEqual(["color", "core", "blue", "500"]);
    expect(splitTokenPath("color-brand-primary")).toEqual(["color", "brand", "primary"]);
    expect(splitTokenPath("spacing")).toEqual(["spacing"]);
  });
});

describe("getTokenGroupSegments", () => {
  it("drops the leaf segment", () => {
    expect(getTokenGroupSegments("color.core.blue-500")).toEqual(["color", "core", "blue"]);
    expect(getTokenGroupSegments("spacing")).toEqual([]);
  });
});

describe("buildTokenTree", () => {
  it("groups dash- and dot-separated tokens under a shared tree", () => {
    const tokens = [
      row("color.core.blue.500"),
      row("color.core.gray.50"),
      row("color-brand-primary"),
      row("spacing"),
    ];

    const tree = buildTokenTree(tokens);
    const colorNode = tree.find((node) => node.label === "color");

    expect(colorNode).toBeDefined();
    expect(colorNode!.tokenCount).toBe(3);

    const coreNode = colorNode!.children.find((node) => node.label === "core");
    expect(coreNode?.tokenCount).toBe(2);

    const brandNode = colorNode!.children.find((node) => node.label === "brand");
    expect(brandNode?.tokenCount).toBe(1);

    // "spacing" has no group segments, so it never appears in the tree.
    expect(tree.some((node) => node.label === "spacing")).toBe(false);
  });
});

describe("tokenMatchesGroup", () => {
  it("matches tokens by prefix segments", () => {
    expect(tokenMatchesGroup(row("color.core.blue.500"), ["color", "core"])).toBe(true);
    expect(tokenMatchesGroup(row("color.core.blue.500"), ["color", "brand"])).toBe(false);
    expect(tokenMatchesGroup(row("color-brand-primary"), ["color", "brand"])).toBe(true);
  });
});
