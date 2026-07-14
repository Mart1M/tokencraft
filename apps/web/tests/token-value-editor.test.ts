import { describe, expect, it } from "vitest";

import { buildTokenDisplayValue } from "@/lib/tokens/display";
import { formatDraftValue } from "@/lib/tokens/draft-utils";
import {
  compositeFieldValuesToObject,
  getDefaultLiteralValueForType,
  serializeCompositeFieldValues,
} from "@/lib/tokens/value-editor";

describe("composite token value editor", () => {
  it("serializes shadow field values into a DTCG object", () => {
    const rawValue = serializeCompositeFieldValues("shadow", {
      offsetX: "0px",
      offsetY: "1px",
      blur: "2px",
      spread: "0px",
      color: "rgba(15, 23, 42, 0.12)",
    });

    expect(compositeFieldValuesToObject("shadow", JSON.parse(rawValue))).toEqual({
      offsetX: "0px",
      offsetY: "1px",
      blur: "2px",
      spread: "0px",
      color: "rgba(15, 23, 42, 0.12)",
    });

    expect(buildTokenDisplayValue(JSON.parse(rawValue), "shadow").kind).toBe("composite");
  });

  it("formats composite draft values as objects", () => {
    const formatted = formatDraftValue({
      valueKind: "literal",
      rawValue: getDefaultLiteralValueForType("shadow"),
      type: "shadow",
    });

    expect(formatted).toEqual({
      offsetX: "0px",
      offsetY: "0px",
      blur: "0px",
      spread: "0px",
      color: "#000000",
    });
  });
});
