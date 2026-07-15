import { describe, expect, it } from "vitest";

import { getTokenSidebarCollections } from "@/lib/tokens/entries";
import type { LocalTokenFile } from "@/lib/tokens/fs";

describe("getTokenSidebarCollections", () => {
  it("detects light and dark modes from token file metadata", () => {
    const collections = getTokenSidebarCollections([
      {
        id: "file-1",
        collectionName: "design",
        path: "tokens/design.json",
        format: "dtcg",
        tokenCount: 2,
        metadata: {
          topLevelKeys: ["color"],
          tokens: [
            {
              path: "color.semantic.background.default",
              type: "color",
              value: "light: {color.core.gray.50} · dark: {color.core.gray.900}",
              modes: {
                light: {
                  kind: "alias",
                  text: "{color.core.gray.50}",
                  aliasPath: "color.core.gray.50",
                },
                dark: {
                  kind: "alias",
                  text: "{color.core.gray.900}",
                  aliasPath: "color.core.gray.900",
                },
              },
            },
            {
              path: "color.core.blue.500",
              type: "color",
              value: "#0066FF",
              display: { kind: "color", text: "#0066FF", color: "#0066FF" },
            },
          ],
        },
      } satisfies LocalTokenFile,
    ]);

    expect(collections).toEqual([
      {
        id: "file-1",
        name: "design",
        modes: ["light", "dark"],
        path: "tokens/design.json",
      },
    ]);
  });

  it("falls back to Default when no modes are present", () => {
    const collections = getTokenSidebarCollections([
      {
        id: "file-2",
        collectionName: "core",
        path: "tokens/core.json",
        format: "dtcg",
        tokenCount: 1,
        metadata: {
          topLevelKeys: ["spacing"],
          tokens: [
            {
              path: "spacing.4",
              type: "dimension",
              value: "4px",
              display: { kind: "text", text: "4px" },
            },
          ],
        },
      } satisfies LocalTokenFile,
    ]);

    expect(collections).toEqual([
      {
        id: "file-2",
        name: "core",
        modes: ["Default"],
        path: "tokens/core.json",
      },
    ]);
  });

  it("marks a collection pending delete when its id is staged for removal", () => {
    const collections = getTokenSidebarCollections(
      [
        {
          id: "file-3",
          collectionName: "core",
          path: "tokens/core.json",
          format: "dtcg",
          tokenCount: 0,
          metadata: { topLevelKeys: [], tokens: [] },
        } satisfies LocalTokenFile,
      ],
      ["file-3"]
    );

    expect(collections[0]?.pendingDelete).toBe(true);
  });
});
