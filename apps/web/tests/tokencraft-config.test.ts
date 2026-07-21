import { describe, expect, it } from "vitest";

import {
  buildTokencraftConfigContent,
  parseTokencraftConfig,
  serializeTokencraftConfig,
} from "@/lib/tokencraft/config";

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

  it("parses modeStorage on an otherwise empty config", () => {
    const config = parseTokencraftConfig(
      JSON.stringify({
        version: 1,
        modeStorage: "separate-files",
        files: [],
      })
    );

    expect(config).toEqual({
      version: 1,
      modeStorage: "separate-files",
      files: [],
    });
  });

  it("ignores unknown modeStorage values", () => {
    const config = parseTokencraftConfig(
      JSON.stringify({
        version: 1,
        modeStorage: "something-else",
        files: ["tokens/base.json"],
      })
    );

    expect(config).toEqual({
      version: 1,
      files: ["tokens/base.json"],
    });
  });

  it("preserves explicitly created empty folders", () => {
    const config = parseTokencraftConfig(
      JSON.stringify({
        version: 1,
        files: [],
        folders: ["tokens", "tokens/semantic"],
      })
    );

    expect(config).toEqual({
      version: 1,
      files: [],
      folders: ["tokens", "tokens/semantic"],
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

  it("parses tokenflow collections config", () => {
    const config = parseTokencraftConfig(
      JSON.stringify({
        collections: [
          {
            name: "Semantic",
            files: ["tokens/Semantic-2.json"],
            modes: ["Light", "Dark"],
          },
          {
            name: "Core",
            files: ["tokens/Core-4.json"],
            modes: ["Value"],
          },
        ],
      })
    );

    expect(config).toEqual({
      version: 1,
      files: ["tokens/Semantic-2.json", "tokens/Core-4.json"],
      fileCollections: {
        "tokens/Semantic-2.json": {
          name: "Semantic",
          modes: ["Light", "Dark"],
        },
        "tokens/Core-4.json": {
          name: "Core",
          modes: ["Value"],
        },
      },
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

  it("writes modeStorage when it is not the default", () => {
    expect(serializeTokencraftConfig([], [], "separate-files")).toBe(
      `${JSON.stringify(
        {
          version: 1,
          modeStorage: "separate-files",
          files: [],
        },
        null,
        2
      )}\n`
    );
  });
});

describe("buildTokencraftConfigContent", () => {
  it("writes collections when foreign metadata is available", () => {
    expect(
      buildTokencraftConfigContent({
        version: 1,
        files: ["tokens/Semantic.json"],
        fileCollections: {
          "tokens/Semantic.json": {
            name: "Semantic",
            modes: ["Light", "Dark"],
          },
        },
      })
    ).toBe(
      `${JSON.stringify(
        {
          version: 1,
          collections: [
            {
              name: "Semantic",
              files: ["tokens/Semantic.json"],
              modes: ["Light", "Dark"],
            },
          ],
        },
        null,
        2
      )}\n`
    );
  });

  it("writes modeStorage with collections", () => {
    expect(
      buildTokencraftConfigContent({
        version: 1,
        modeStorage: "separate-files",
        files: [
          "tokens/semantic/light.tokens.json",
          "tokens/semantic/dark.tokens.json",
        ],
        fileCollections: {
          "tokens/semantic/light.tokens.json": {
            name: "Semantic",
            modes: ["light", "dark"],
          },
          "tokens/semantic/dark.tokens.json": {
            name: "Semantic",
            modes: ["light", "dark"],
          },
        },
      })
    ).toBe(
      `${JSON.stringify(
        {
          version: 1,
          modeStorage: "separate-files",
          collections: [
            {
              name: "Semantic",
              files: [
                "tokens/semantic/light.tokens.json",
                "tokens/semantic/dark.tokens.json",
              ],
              modes: ["light", "dark"],
            },
          ],
        },
        null,
        2
      )}\n`
    );
  });

  it("writes explicit folders alongside collections", () => {
    expect(
      buildTokencraftConfigContent({
        version: 1,
        files: ["tokens/base.json"],
        folders: ["tokens", "tokens/semantic"],
      })
    ).toBe(
      `${JSON.stringify(
        {
          version: 1,
          files: ["tokens/base.json"],
          folders: ["tokens", "tokens/semantic"],
        },
        null,
        2
      )}\n`
    );
  });
});
