import { describe, expect, it } from "vitest";

import {
  getCollectionKey,
  getCompositeProperty,
  getCompositeTokenValue,
  getFontFamilyCandidates,
  getFigmaVariableType,
  getTokenModeValue,
  parseTokenValue,
  toFigmaVariableName,
} from "./token-utils";

describe("Figma token conversion", () => {
  it("matches collection names without case or surrounding-space differences", () => {
    expect(getCollectionKey(" core ")).toBe(getCollectionKey("Core"));
  });

  it("maps supported DTCG types to Figma Variable types", () => {
    expect(getFigmaVariableType("color")).toBe("COLOR");
    expect(getFigmaVariableType("number")).toBe("FLOAT");
    expect(getFigmaVariableType("dimension")).toBe("FLOAT");
    expect(getFigmaVariableType("boolean")).toBe("BOOLEAN");
    expect(getFigmaVariableType("fontFamily")).toBe("STRING");
    expect(getFigmaVariableType("border")).toBeNull();
  });

  it("parses color values, number units and aliases", () => {
    expect(parseTokenValue("#531fff", "COLOR")).toEqual({
      kind: "color",
      value: { r: 83 / 255, g: 31 / 255, b: 1, a: 1 },
    });
    expect(parseTokenValue("8px", "FLOAT")).toEqual({ kind: "float", value: 8 });
    expect(parseTokenValue("{color.brand.primary}", "COLOR")).toEqual({
      kind: "alias",
      path: "color.brand.primary",
    });
  });

  it("uses per-mode values and Figma slash paths", () => {
    expect(toFigmaVariableName("color.brand.primary")).toBe("color/brand/primary");
    expect(getTokenModeValue({
      id: "colors:color.brand.primary",
      fileId: "colors",
      collectionName: "Colors",
      name: "color.brand.primary",
      value: "#531fff",
      modes: { Dark: { text: "#ffffff" } },
    }, "Dark")).toBe("#ffffff");
  });

  it("reads structured composite values, including per-mode border values", () => {
    const token = {
      id: "borders:default",
      fileId: "borders",
      collectionName: "Borders",
      name: "border.default",
      type: "border",
      value: "border",
      modes: { Dark: { text: "border" } },
      raw: {
        Default: { width: "1px", color: "#ffffff", style: "solid" },
        Dark: { width: "2px", color: "#000000", style: "dashed" },
      },
    };
    expect(getCompositeTokenValue(token, "Dark")).toEqual({ width: "2px", color: "#000000", style: "dashed" });
    expect(getCompositeProperty(token, "Dark", "width", "lineWidth")).toBe("2px");
  });

  it("uses the first available family from a CSS font stack", () => {
    expect(getFontFamilyCandidates('"Inter", sans-serif')).toEqual(["Inter", "sans-serif"]);
  });
});
