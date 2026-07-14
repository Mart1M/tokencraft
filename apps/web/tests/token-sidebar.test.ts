import { describe, expect, it } from "vitest";

import { getTokenSidebarCollections } from "@/lib/tokens/entries";

describe("getTokenSidebarCollections", () => {
  it("detects light and dark modes from token file metadata", () => {
    const collections = getTokenSidebarCollections([
      {
        id: "file-1",
        collectionName: "design",
        path: "tokens/design.json",
        syncStatus: "SYNCED",
        pendingDelete: false,
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
      } as never,
    ]);

    expect(collections).toEqual([
      {
        id: "file-1",
        name: "design",
        modes: ["light", "dark"],
        syncStatus: "SYNCED",
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
        syncStatus: "SYNCED",
        pendingDelete: false,
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
      } as never,
    ]);

    expect(collections).toEqual([
      {
        id: "file-2",
        name: "core",
        modes: ["Default"],
        syncStatus: "SYNCED",
        path: "tokens/core.json",
      },
    ]);
  });
});
