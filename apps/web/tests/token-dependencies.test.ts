import { describe, expect, it } from "vitest";

import {
  extractTokenReferences,
  getTokenDependencyGraph,
  resolveAliasChain,
} from "@/lib/tokens/token-dependencies";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

function token(
  id: string,
  name: string,
  value: string,
  overrides: Partial<ImportedTokenRow> = {},
): ImportedTokenRow {
  return {
    id,
    fileId: overrides.fileId ?? "core",
    sourcePath: "tokens/core.json",
    collectionName: overrides.collectionName ?? "Core",
    name,
    type: "color",
    value,
    display: { kind: "text", text: value },
    ...overrides,
  };
}

describe("token dependencies", () => {
  it("extracts aliases from values, composite objects and expressions", () => {
    expect(extractTokenReferences({
      color: "{color.brand}",
      shadow: ["calc({space.2} * 2)", "{color.shadow}"],
    })).toEqual(["color.brand", "space.2", "color.shadow"]);
  });

  it("does not treat a serialized composite object as an alias", () => {
    expect(extractTokenReferences(
      '{"fontFamily":"Inter, sans-serif","fontSize":"16px","fontWeight":"400"}',
    )).toEqual([]);
  });

  it("resolves incoming cross-collection references and unknown aliases", () => {
    const brand = token("core:brand", "color.brand", "#0066ff");
    const semantic = token("semantic:text", "color.text", "{color.brand}", {
      fileId: "semantic",
      collectionName: "Semantic",
    });
    const broken = token("semantic:broken", "color.broken", "{color.missing}", {
      fileId: "semantic",
      collectionName: "Semantic",
    });

    const graph = getTokenDependencyGraph(brand, [brand, semantic, broken], {}, null);
    expect(graph.incoming.map((dependency) => dependency.path)).toEqual(["color.text"]);
    expect(getTokenDependencyGraph(broken, [brand, semantic, broken], {}, null).outgoing[0]).toMatchObject({
      path: "color.missing",
      missing: true,
    });
  });

  it("keeps every mode visible and applies unsaved drafts", () => {
    const light = token("core:light", "color.light", "#fff");
    const dark = token("core:dark", "color.dark", "#000");
    const surface = token("semantic:surface", "color.surface", "{color.light}", {
      fileId: "semantic",
      modes: {
        Light: { kind: "alias", text: "{color.light}", aliasPath: "color.light" },
        Dark: { kind: "alias", text: "{color.dark}", aliasPath: "color.dark" },
      },
    });

    expect(getTokenDependencyGraph(surface, [light, dark, surface], {}, "Dark").outgoing).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "color.light", mode: "Light" }),
      expect.objectContaining({ path: "color.dark", mode: "Dark" }),
    ]));
    expect(getTokenDependencyGraph(surface, [light, dark, surface], {
      [surface.id]: {
        tokenId: surface.id,
        fileId: surface.fileId,
        path: surface.name,
        mode: null,
        valueKind: "alias",
        rawValue: "color.light",
      },
    }, null).outgoing[0]?.path).toBe("color.light");
  });

  it("labels incoming references with the mode in which each link is defined", () => {
    const light = token("core:light", "color.light", "#fff");
    const dark = token("core:dark", "color.dark", "#000");
    const surface = token("semantic:surface", "color.surface", "{color.light}", {
      fileId: "semantic",
      modes: {
        Light: { kind: "alias", text: "{color.light}", aliasPath: "color.light" },
        Dark: { kind: "alias", text: "{color.dark}", aliasPath: "color.dark" },
      },
    });

    expect(getTokenDependencyGraph(dark, [light, dark, surface], {}, null).incoming).toMatchObject([
      { path: "color.surface", mode: "Dark" },
    ]);
    expect(getTokenDependencyGraph(light, [light, dark, surface], {}, null).incoming).toMatchObject([
      { path: "color.surface", mode: "Light" },
    ]);
  });

  it("reports self references and cycles", () => {
    const first = token("core:first", "color.first", "{color.second}");
    const second = token("core:second", "color.second", "{color.first}");

    expect(getTokenDependencyGraph(first, [first, second], {}, null).cycle).not.toBeNull();
  });

  it("resolves multi-level alias chains to the final literal", () => {
    const core = token("core:full", "vp.core.border-radius.full", "9999", {
      type: "borderRadius",
      display: { kind: "text", text: "9999" },
    });
    const semantic = token(
      "semantic:full",
      "vp.semantic.border-radius.full",
      "{vp.core.border-radius.full}",
      {
        type: "borderRadius",
        fileId: "semantic",
        collectionName: "Semantic",
        display: {
          kind: "alias",
          text: "{vp.core.border-radius.full}",
          aliasPath: "vp.core.border-radius.full",
        },
      },
    );

    expect(resolveAliasChain("vp.semantic.border-radius.full", [core, semantic], null)).toEqual([
      {
        path: "vp.semantic.border-radius.full",
        valueText: "{vp.core.border-radius.full}",
        missing: false,
        isAlias: true,
      },
      {
        path: "vp.core.border-radius.full",
        valueText: "9999",
        missing: false,
        isAlias: false,
      },
    ]);
  });

  it("marks missing aliases in the chain", () => {
    expect(resolveAliasChain("color.missing", [], null)).toEqual([
      {
        path: "color.missing",
        valueText: null,
        missing: true,
        isAlias: false,
      },
    ]);
  });
});
