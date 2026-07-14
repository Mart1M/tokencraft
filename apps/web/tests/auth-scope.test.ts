import { describe, expect, it } from "vitest";
import { resolveActorScope, toDbScope } from "@/lib/auth/scope";

describe("actor scope", () => {
  it("uses organization scope when an org is active", () => {
    expect(resolveActorScope({ userId: "user_1", orgId: "org_1" })).toEqual({
      scope: "organization",
      ownerId: "org_1"
    });
  });

  it("falls back to user scope", () => {
    expect(resolveActorScope({ userId: "user_1" })).toEqual({
      scope: "user",
      ownerId: "user_1"
    });
    expect(toDbScope("user")).toBe("USER");
  });
});
