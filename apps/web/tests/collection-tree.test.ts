import { describe, expect, it } from "vitest";

import { buildCollectionTree } from "@/lib/tokens/collection-tree";

describe("buildCollectionTree", () => {
  it("keeps explicitly created empty folders alongside collection-derived folders", () => {
    const tree = buildCollectionTree(
      [
        {
          id: "core",
          name: "Core",
          modes: ["Default"],
          path: "tokens/core.json",
        },
      ],
      ["tokens/semantic", "drafts"],
    );

    expect(tree).toMatchObject([
      {
        id: "drafts",
        kind: "folder",
        children: [],
      },
      {
        id: "tokens",
        kind: "folder",
        children: [
          { id: "tokens/semantic", kind: "folder", children: [] },
          { id: "core", kind: "collection" },
        ],
      },
    ]);
  });

  it("renders multi-mode sibling files as a single collection leaf", () => {
    const tree = buildCollectionTree([
      {
        id: "legacy",
        name: "semantic / legacy",
        modes: ["light", "dark"],
        path: "semantic/legacy",
      },
    ]);

    expect(tree).toMatchObject([
      {
        id: "semantic",
        kind: "folder",
        label: "semantic",
        children: [
          {
            id: "legacy",
            kind: "collection",
            label: "legacy (2 modes)",
          },
        ],
      },
    ]);
  });
});
