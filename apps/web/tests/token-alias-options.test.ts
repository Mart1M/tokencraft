import { describe, expect, it } from "vitest";

import { getTokenAliasOptions } from "@/lib/tokens/entries";

describe("getTokenAliasOptions", () => {
  it("returns all tokens grouped by collection excluding the current token", () => {
    const options = getTokenAliasOptions(
      [
        {
          id: "a:color.primary",
          fileId: "a",
          sourcePath: "tokens/core.json",
          collectionName: "core",
          name: "color.primary",
          type: "color",
          value: "#000",
        },
        {
          id: "b:spacing.4",
          fileId: "b",
          sourcePath: "tokens/spacing.json",
          collectionName: "spacing",
          name: "spacing.4",
          type: "dimension",
          value: "4px",
        },
      ],
      "a:color.primary"
    );

    expect(options).toEqual([
      {
        path: "spacing.4",
        type: "dimension",
        collectionName: "spacing",
        sourcePath: "tokens/spacing.json",
      },
    ]);
  });
});
