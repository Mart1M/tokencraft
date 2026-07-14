import { describe, expect, it } from "vitest";

import { normalizeWorkspaceSlug } from "@/lib/workspaces/slug";

describe("normalizeWorkspaceSlug", () => {
  it("normalizes names into URL-safe slugs", () => {
    expect(normalizeWorkspaceSlug("Design System")).toBe("design-system");
  });

  it("falls back to workspace when empty", () => {
    expect(normalizeWorkspaceSlug("   ")).toBe("workspace");
  });
});
