import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { flattenTokenEntries } from "@/lib/tokens/flatten";
import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import { inspectTokenJson } from "@/lib/github/token-scan";

const dtcgExample = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/dtcg-example.json"), "utf8")
) as Record<string, unknown>;

describe("formatDtcgTokenValue", () => {
  it("formats mode-based color values", () => {
    expect(
      formatDtcgTokenValue(
        {
          light: "{color.core.gray.50}",
          dark: "{color.core.gray.900}"
        },
        "color"
      )
    ).toBe("light: {color.core.gray.50} · dark: {color.core.gray.900}");
  });

  it("formats font family arrays", () => {
    expect(formatDtcgTokenValue(["Inter", "Arial", "sans-serif"], "fontFamily")).toBe(
      "Inter, Arial, sans-serif"
    );
  });

  it("formats cubic bezier arrays", () => {
    expect(formatDtcgTokenValue([0, 0, 0.2, 1], "cubicBezier")).toBe("cubic-bezier(0, 0, 0.2, 1)");
  });

  it("formats composite shadow values", () => {
    expect(
      formatDtcgTokenValue(
        {
          color: "rgba(15, 23, 42, 0.12)",
          offsetX: "0px",
          offsetY: "1px",
          blur: "2px",
          spread: "0px"
        },
        "shadow"
      )
    ).toBe("0px 1px 2px 0px rgba(15, 23, 42, 0.12)");
  });
});

describe("flattenTokenEntries", () => {
  it("flattens the full DTCG example into token paths", () => {
    const tokens = flattenTokenEntries(dtcgExample);

    expect(tokens).toHaveLength(25);
    expect(tokens).toContainEqual(
      expect.objectContaining({
        path: "color.core.blue.500",
        type: "color",
        value: "#0066FF",
        display: { kind: "color", text: "#0066FF", color: "#0066FF" },
      })
    );
    expect(tokens).toContainEqual(
      expect.objectContaining({
        path: "color.semantic.background.default",
        type: "color",
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
      })
    );
    expect(tokens).toContainEqual(
      expect.objectContaining({
        path: "fontFamily.sans",
        type: "fontFamily",
        value: "Inter, Arial, sans-serif",
      })
    );
    expect(tokens).toContainEqual(
      expect.objectContaining({
        path: "shadow.md",
        type: "shadow",
        value: "2 layers",
      })
    );
    expect(tokens).toContainEqual(
      expect.objectContaining({
        path: "asset.logo",
        type: "asset",
        value: "https://example.com/logo.svg (svg)",
      })
    );
  });
});

describe("inspectTokenJson", () => {
  it("detects DTCG token files and counts nested tokens", () => {
    const result = inspectTokenJson(
      "tokens/core.tokens.json",
      JSON.stringify({
        color: {
          brand: {
            primary: {
              $type: "color",
              $value: "#531fff"
            }
          }
        },
        spacing: {
          md: {
            $type: "dimension",
            $value: "16px"
          }
        }
      })
    );

    expect(result.collectionName).toBe("core");
    expect(result.format).toBe("DTCG");
    expect(result.tokenCount).toBe(2);
    expect(result.metadata.tokens).toEqual([
      {
        path: "color.brand.primary",
        type: "color",
        value: "#531fff",
        raw: "#531fff",
        display: { kind: "color", text: "#531fff", color: "#531fff" },
      },
      {
        path: "spacing.md",
        type: "dimension",
        value: "16px",
        raw: "16px",
        display: { kind: "text", text: "16px" },
      },
    ]);
  });

  it("stores formatted values for the DTCG example file", () => {
    const result = inspectTokenJson("tokens/design.tokens.json", JSON.stringify(dtcgExample));

    expect(result.format).toBe("DTCG");
    expect(result.tokenCount).toBe(25);
    expect(result.metadata.tokens).toHaveLength(25);
  });
});
