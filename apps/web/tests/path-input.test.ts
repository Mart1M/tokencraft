import { describe, expect, it } from "vitest";

import { sanitizeFolderPathInput } from "@/lib/tokens/path-input";

describe("sanitizeFolderPathInput", () => {
  it("strips an @ file-reference prefix with double quotes", () => {
    expect(sanitizeFolderPathInput('@"/Users/martinm/Downloads/TEST/"')).toBe(
      "/Users/martinm/Downloads/TEST"
    );
  });

  it("strips an @ file-reference prefix with single quotes", () => {
    expect(sanitizeFolderPathInput("@'/Users/martinm/Downloads/TEST'")).toBe(
      "/Users/martinm/Downloads/TEST"
    );
  });

  it("strips plain surrounding quotes without an @ prefix", () => {
    expect(sanitizeFolderPathInput('"/Users/martinm/Downloads/TEST"')).toBe(
      "/Users/martinm/Downloads/TEST"
    );
  });

  it("strips a trailing slash", () => {
    expect(sanitizeFolderPathInput("/Users/martinm/Downloads/TEST/")).toBe(
      "/Users/martinm/Downloads/TEST"
    );
  });

  it("leaves an already-clean path untouched", () => {
    expect(sanitizeFolderPathInput("/Users/martinm/Downloads/TEST")).toBe(
      "/Users/martinm/Downloads/TEST"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeFolderPathInput("  /Users/martinm/Downloads/TEST  ")).toBe(
      "/Users/martinm/Downloads/TEST"
    );
  });

  it("keeps the root path intact", () => {
    expect(sanitizeFolderPathInput("/")).toBe("/");
  });
});
