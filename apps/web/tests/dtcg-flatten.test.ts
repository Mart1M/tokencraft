import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { flattenTokenEntries } from "@/lib/tokens/flatten";
import { formatDtcgTokenValue } from "@/lib/tokens/dtcg-format";
import { inspectTokenJson } from "@/lib/tokens/fs";

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

  it("formats Tokens Studio boxShadow layers", () => {
    expect(
      formatDtcgTokenValue(
        [
          {
            blur: "0",
            color: "{vp.core.color.white}",
            spread: "4",
            type: "dropShadow",
            x: "0",
            y: "0",
          },
          {
            blur: "0",
            color: "{vp.core.color.black}",
            spread: "6",
            type: "dropShadow",
            x: "0",
            y: "0",
          },
        ],
        "boxShadow"
      )
    ).toBe("0 0 0 4 {vp.core.color.white}, 0 0 0 6 {vp.core.color.black}");
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
        value: "0px 4px 8px 0px rgba(15, 23, 42, 0.10), 0px 2px 4px 0px rgba(15, 23, 42, 0.06)",
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

describe("Tokens Studio composition tokens", () => {
  const compositionExample = JSON.parse(
    readFileSync(resolve(__dirname, "fixtures/tokens-studio-composition.json"), "utf8")
  ) as Record<string, unknown>;

  it("flattens composition typography tokens from Tokens Studio format", () => {
    const tokens = flattenTokenEntries(compositionExample);

    expect(tokens).toContainEqual(
      expect.objectContaining({
        path: "vp.android.component.accordion.typography.label",
        type: "composition",
        value: "typography: {vp.semantic.typography.mobile.body-m}",
        display: {
          kind: "composite",
          text: "typography: {vp.semantic.typography.mobile.body-m}",
          parts: [
            { kind: "text", text: "typography: " },
            {
              kind: "alias",
              text: "{vp.semantic.typography.mobile.body-m}",
              aliasPath: "vp.semantic.typography.mobile.body-m",
            },
          ],
        },
        raw: {
          typography: "{vp.semantic.typography.mobile.body-m}",
        },
      })
    );
  });

  it("detects tokens-studio format for composition files", () => {
    const inspected = inspectTokenJson(
      "component/accordion/android.json",
      JSON.stringify(compositionExample)
    );

    expect(inspected.format).toBe("tokens-studio");
    expect(inspected.tokenCount).toBe(2);
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
    expect(result.format).toBe("dtcg");
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

    expect(result.format).toBe("dtcg");
    expect(result.tokenCount).toBe(25);
    expect(result.metadata.tokens).toHaveLength(25);
  });
});
