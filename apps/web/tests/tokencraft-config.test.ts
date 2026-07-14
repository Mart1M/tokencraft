import { describe, expect, it } from "vitest";

import { parseTokencraftConfig, serializeTokencraftConfig } from "@/lib/tokencraft/config";

describe("parseTokencraftConfig", () => {
  it("parses the files array format", () => {
    const config = parseTokencraftConfig(
      JSON.stringify({
        version: 1,
        files: ["tokens/base.json", "tokens/semantic.json"]
      })
    );

    expect(config).toEqual({
      version: 1,
      files: ["tokens/base.json", "tokens/semantic.json"]
    });
  });

  it("parses the legacy sources format", () => {
    const config = parseTokencraftConfig(
      JSON.stringify({
        adapter: "dtcg",
        sources: [
          { name: "Base", path: "tokens/base.json" },
          { name: "Semantic", path: "tokens/semantic.json" }
        ]
      })
    );

    expect(config).toEqual({
      version: 1,
      files: ["tokens/base.json", "tokens/semantic.json"]
    });
  });

  it("returns null for invalid config", () => {
    expect(parseTokencraftConfig("{")).toBeNull();
    expect(parseTokencraftConfig(JSON.stringify({ version: 1, files: [] }))).toBeNull();
  });
});

describe("serializeTokencraftConfig", () => {
  it("writes a stable config file", () => {
    expect(serializeTokencraftConfig(["tokens/base.json", "tokens/base.json"])).toBe(
      `${JSON.stringify(
        {
          version: 1,
          files: ["tokens/base.json"]
        },
        null,
        2
      )}\n`
    );
  });
});
