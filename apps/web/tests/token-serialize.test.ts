import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectTokenJson } from "@/lib/github/token-scan";
import { setTokenAtPath } from "@/lib/tokens/json-patch";
import { parseTokenFileMetadata } from "@/lib/tokens/flatten";
import { entryToRawValue } from "@/lib/tokens/serialize";

const dtcgExample = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/dtcg-example.json"), "utf8")
) as Record<string, unknown>;

describe("entryToRawValue", () => {
  it("preserves mode-based $value objects when pushing", () => {
    const metadata = inspectTokenJson("tokens/design.tokens.json", JSON.stringify(dtcgExample))
      .metadata;
    const entry = metadata.tokens.find(
      (token) => token.path === "color.semantic.background.default"
    );

    expect(entry).toBeDefined();
    expect(entryToRawValue(entry!)).toEqual({
      light: "{color.core.gray.50}",
      dark: "{color.core.gray.900}",
    });
  });

  it("round-trips metadata back into JSON without flattening modes", () => {
    const metadata = parseTokenFileMetadata(
      inspectTokenJson("tokens/design.tokens.json", JSON.stringify(dtcgExample)).metadata
    );
    const json = JSON.parse(JSON.stringify(dtcgExample)) as Record<string, unknown>;

    for (const entry of metadata.tokens) {
      setTokenAtPath(json, entry.path, entryToRawValue(entry), entry.type);
    }

    const background = (
      json.color as Record<string, unknown>
    ).semantic as Record<string, unknown>;
    const token = (background.background as Record<string, unknown>).default as Record<
      string,
      unknown
    >;

    expect(token.$value).toEqual({
      light: "{color.core.gray.50}",
      dark: "{color.core.gray.900}",
    });
  });

  it("reconstructs mode values from legacy formatted strings", () => {
    expect(
      entryToRawValue({
        path: "color.semantic.background.default",
        type: "color",
        value: "light: {color.core.gray.50} · dark: {color.core.gray.900}",
      })
    ).toEqual({
      light: "{color.core.gray.50}",
      dark: "{color.core.gray.900}",
    });
  });
});
