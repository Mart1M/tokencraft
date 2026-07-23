import { describe, expect, it } from "vitest";

import type { PendingModeChange } from "@/lib/tokens/draft-store";
import { modesEqual, resolveModeDataKey } from "@/lib/tokens/mode-changes";
import {
  collectionIdFromName,
  mergeSeparateModeFiles,
} from "@/lib/tokens/mode-storage";

describe("mode changes helpers", () => {
  it("compares mode lists by order", () => {
    expect(modesEqual(["Light", "Dark"], ["Light", "Dark"])).toBe(true);
    expect(modesEqual(["Light", "Dark"], ["Dark", "Light"])).toBe(false);
  });

  it("maps renamed display modes back to loaded data keys", () => {
    const pending: PendingModeChange[] = [
      {
        id: "c1:rename:Light",
        fileId: "c1",
        action: "rename",
        oldMode: "Light",
        newMode: "Day",
        modes: ["Light", "Dark"],
      },
    ];

    expect(resolveModeDataKey("Day", pending, "c1")).toBe("Light");
    expect(resolveModeDataKey("Dark", pending, "c1")).toBe("Dark");
    expect(resolveModeDataKey("Day", pending, "other")).toBe("Day");
  });

  it("resolves chained renames to the original data key", () => {
    const pending: PendingModeChange[] = [
      {
        id: "c1:rename:Light",
        fileId: "c1",
        action: "rename",
        oldMode: "Light",
        newMode: "Day",
        modes: ["Light", "Dark"],
      },
      {
        id: "c1:rename:Day",
        fileId: "c1",
        action: "rename",
        oldMode: "Day",
        newMode: "Night",
        modes: ["Day", "Dark"],
      },
    ];

    expect(resolveModeDataKey("Night", pending, "c1")).toBe("Light");
  });
});

describe("separate-files collection ids", () => {
  it("keeps the same collection id when mode file paths change", () => {
    const before = mergeSeparateModeFiles({
      collectionName: "Semantic",
      modeStorage: "separate-files",
      modeFiles: [
        {
          mode: "light",
          file: {
            path: "tokens/semantic/light.tokens.json",
            format: "dtcg",
            metadata: { topLevelKeys: [], tokens: [] },
          },
        },
        {
          mode: "dark",
          file: {
            path: "tokens/semantic/dark.tokens.json",
            format: "dtcg",
            metadata: { topLevelKeys: [], tokens: [] },
          },
        },
      ],
    });

    const after = mergeSeparateModeFiles({
      collectionName: "Semantic",
      modeStorage: "separate-files",
      modeFiles: [
        {
          mode: "day",
          file: {
            path: "tokens/semantic/day.tokens.json",
            format: "dtcg",
            metadata: { topLevelKeys: [], tokens: [] },
          },
        },
        {
          mode: "dark",
          file: {
            path: "tokens/semantic/dark.tokens.json",
            format: "dtcg",
            metadata: { topLevelKeys: [], tokens: [] },
          },
        },
      ],
    });

    expect(before.id).toBe(after.id);
    expect(before.id).toBe(collectionIdFromName("Semantic"));
  });
});
