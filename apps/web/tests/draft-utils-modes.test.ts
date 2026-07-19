import { describe, expect, it } from "vitest";

import {
  applyDraftToRow,
  buildDraftFromRow,
  getEditableRawValue,
} from "@/lib/tokens/draft-utils";
import type { ImportedTokenRow } from "@/lib/tokens/entries";

function makeFlatColorToken(): ImportedTokenRow {
  return {
    id: "core:color.primary.500",
    fileId: "core",
    sourcePath: "tokens/core.json",
    collectionName: "core",
    name: "color.primary.500",
    type: "color",
    value: "#0066ff",
    display: { kind: "color", text: "#0066ff", color: "#0066ff" },
  };
}

function makeMultiModeColorToken(): ImportedTokenRow {
  return {
    id: "core:color.bg.default",
    fileId: "core",
    sourcePath: "tokens/core.json",
    collectionName: "core",
    name: "color.bg.default",
    type: "color",
    value: "light: #ffffff · dark: #000000",
    modes: {
      light: { kind: "color", text: "#ffffff", color: "#ffffff" },
      dark: { kind: "color", text: "#000000", color: "#000000" },
    },
  };
}

describe("getEditableRawValue with a newly added mode", () => {
  it("seeds the editor from the current flat value for a token without modes yet", () => {
    const token = makeFlatColorToken();

    const editable = getEditableRawValue(token, "Dark");

    expect(editable).toEqual({ valueKind: "literal", rawValue: "#0066ff" });
  });

  it("starts blank for a brand-new mode on a token that already has other modes", () => {
    const token = makeMultiModeColorToken();

    const editable = getEditableRawValue(token, "contrast");

    expect(editable).toEqual({ valueKind: "literal", rawValue: "" });
  });

  it("still resolves an existing mode value normally", () => {
    const token = makeMultiModeColorToken();

    const editable = getEditableRawValue(token, "dark");

    expect(editable).toEqual({ valueKind: "literal", rawValue: "#000000" });
  });

  it("keeps a composite typography value literal and reads the selected mode", () => {
    const token: ImportedTokenRow = {
      id: "core:typo.body",
      fileId: "core",
      sourcePath: "tokens/core.json",
      collectionName: "core",
      name: "typo.body",
      type: "typography",
      value: "typography",
      raw: {
        "Mode 1": { fontFamily: "Inter", fontSize: "16px", fontWeight: "400", lineHeight: "24px" },
        "Mode 2": { fontFamily: "Inter", fontSize: "18px", fontWeight: "500", lineHeight: "28px" },
      },
      modes: {
        "Mode 1": { kind: "composite", text: "fontSize: 16px" },
        "Mode 2": { kind: "composite", text: "fontSize: 18px" },
      },
    };

    expect(getEditableRawValue(token, "Mode 2")).toMatchObject({
      valueKind: "literal",
      rawValue: expect.stringContaining('"fontSize":"18px"'),
    });
  });
});

describe("applyDraftToRow with a newly added mode", () => {
  it("creates a modes map instead of discarding the existing flat value", () => {
    const token = makeFlatColorToken();
    const draft = buildDraftFromRow(token, "Dark", "literal", "#111111", "update");

    const next = applyDraftToRow(token, draft);

    expect(next.modes?.Default).toMatchObject({ text: "#0066ff" });
    expect(next.modes?.Dark).toMatchObject({ text: "#111111" });
  });

  it("adds a brand-new mode to a token that already has other modes", () => {
    const token = makeMultiModeColorToken();
    const draft = buildDraftFromRow(token, "contrast", "literal", "#ff00ff", "update");

    const next = applyDraftToRow(token, draft);

    expect(next.modes?.light).toMatchObject({ text: "#ffffff" });
    expect(next.modes?.dark).toMatchObject({ text: "#000000" });
    expect(next.modes?.contrast).toMatchObject({ text: "#ff00ff" });
  });
});
