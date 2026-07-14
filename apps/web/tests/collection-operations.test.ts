import { describe, expect, it } from "vitest";

function normalizeCollectionPath(path: string) {
  return path.trim().replace(/^\/+/, "");
}

function validateCollectionPath(path: string) {
  const normalized = normalizeCollectionPath(path);

  if (!normalized) {
    throw new Error("Collection path is required.");
  }

  if (!normalized.toLowerCase().endsWith(".json")) {
    throw new Error("Collection path must end with .json.");
  }

  if (normalized.includes("..")) {
    throw new Error("Collection path is invalid.");
  }

  return normalized;
}

function deriveCollectionName(path: string, displayName?: string) {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  const filename = path.split("/").pop() ?? path;
  return filename.replace(/\.json$/i, "");
}

describe("collection path validation", () => {
  it("normalizes leading slashes", () => {
    expect(validateCollectionPath("/tokens/brand.json")).toBe("tokens/brand.json");
  });

  it("rejects non-json paths", () => {
    expect(() => validateCollectionPath("tokens/brand")).toThrow(/\.json/);
  });

  it("derives a display name from the filename", () => {
    expect(deriveCollectionName("tokens/brand.json")).toBe("brand");
    expect(deriveCollectionName("tokens/brand.json", "Brand tokens")).toBe("Brand tokens");
  });
});

describe("collection delete behavior", () => {
  it("marks synced collections for pending delete instead of immediate removal", () => {
    type SyncStatus = "SYNCED" | "LOCAL";

    function deleteBehavior(syncStatus: SyncStatus) {
      if (syncStatus === "LOCAL") {
        return "deleted";
      }

      return { syncStatus, pendingDelete: true };
    }

    expect(deleteBehavior("SYNCED")).toEqual({ syncStatus: "SYNCED", pendingDelete: true });
    expect(deleteBehavior("LOCAL")).toBe("deleted");
  });
});
