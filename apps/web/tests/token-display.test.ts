import { describe, expect, it } from "vitest";

import { buildTokenDisplayValue, parseStringIntoComposite, resolveDisplayColor } from "@/lib/tokens/display";

describe("composite token display", () => {
  it("renders border values with alias tags", () => {
    const display = buildTokenDisplayValue(
      {
        color: "{color.semantic.text.default}",
        width: "1px",
        style: "{strokeStyle.solid}",
      },
      "border"
    );

    expect(display).toEqual({
      kind: "composite",
      text: "1px {strokeStyle.solid} {color.semantic.text.default}",
      parts: [
        { kind: "text", text: "1px" },
        { kind: "text", text: " " },
        { kind: "alias", text: "{strokeStyle.solid}", aliasPath: "strokeStyle.solid" },
        { kind: "text", text: " " },
        {
          kind: "alias",
          text: "{color.semantic.text.default}",
          aliasPath: "color.semantic.text.default",
        },
      ],
    });
  });

  it("parses legacy border strings into alias parts", () => {
    expect(
      parseStringIntoComposite("1px {strokeStyle.solid} {color.semantic.text.default}")
    ).toEqual({
      kind: "composite",
      text: "1px {strokeStyle.solid} {color.semantic.text.default}",
      parts: [
        { kind: "text", text: "1px " },
        { kind: "alias", text: "{strokeStyle.solid}", aliasPath: "strokeStyle.solid" },
        { kind: "text", text: " " },
        {
          kind: "alias",
          text: "{color.semantic.text.default}",
          aliasPath: "color.semantic.text.default",
        },
      ],
    });
  });

  it("renders shadow values with structured parts", () => {
    const display = buildTokenDisplayValue(
      {
        color: "rgba(15, 23, 42, 0.12)",
        offsetX: "0px",
        offsetY: "1px",
        blur: "2px",
        spread: "0px",
      },
      "shadow"
    );

    expect(display.kind).toBe("composite");
    expect(display.parts).toEqual(
      expect.arrayContaining([
        { kind: "text", text: "0px" },
        { kind: "text", text: "1px" },
        { kind: "text", text: "2px" },
        {
          kind: "color",
          color: "rgba(15, 23, 42, 0.12)",
          text: "rgba(15, 23, 42, 0.12)",
        },
      ])
    );
  });

  it("renders typography values with alias tags", () => {
    const display = buildTokenDisplayValue(
      {
        fontFamily: "{fontFamily.sans}",
        fontSize: "16px",
        fontWeight: "{fontWeight.regular}",
        lineHeight: "24px",
      },
      "typography"
    );

    expect(display.kind).toBe("composite");
    expect(display.parts).toEqual(
      expect.arrayContaining([
        { kind: "text", text: "fontFamily: " },
        { kind: "alias", text: "{fontFamily.sans}", aliasPath: "fontFamily.sans" },
        { kind: "text", text: "fontWeight: " },
        { kind: "alias", text: "{fontWeight.regular}", aliasPath: "fontWeight.regular" },
      ])
    );
  });

  it("renders Tokens Studio composition typography references", () => {
    const display = buildTokenDisplayValue(
      {
        typography: "{vp.semantic.typography.mobile.body-m}",
      },
      "composition"
    );

    expect(display).toEqual({
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
    });
  });
});

describe("hex color display", () => {
  it("detects hex colors without an explicit token type", () => {
    expect(buildTokenDisplayValue("#3b82f6")).toEqual({
      kind: "color",
      text: "#3b82f6",
      color: "#3b82f6",
    });
  });

  it("detects 8-digit hex colors with alpha", () => {
    expect(buildTokenDisplayValue("#3b82f61a")).toEqual({
      kind: "color",
      text: "#3b82f61a",
      color: "#3b82f61a",
    });
  });

  it("resolves preview color from plain text hex values", () => {
    expect(
      resolveDisplayColor({
        kind: "text",
        text: "#112233",
      })
    ).toBe("#112233");
  });

  it("resolves Default mode values from lowercase default keys", async () => {
    const { getRowModeDisplayValue } = await import("@/lib/tokens/display");

    expect(
      getRowModeDisplayValue(
        {
          value: "default: #112233",
          type: "color",
          modes: {
            default: { kind: "color", text: "#112233", color: "#112233" },
            Light: { kind: "color", text: "#ffffff", color: "#ffffff" },
          },
        },
        "Default"
      )
    ).toEqual({
      kind: "color",
      text: "#112233",
      color: "#112233",
    });
  });
});
