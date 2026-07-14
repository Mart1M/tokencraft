import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/workspaces/route";
import { prisma } from "@/lib/db/prisma";
import { getAuthSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

describe("POST /api/workspaces", () => {
  const ownerId = "test-user-workspaces-route";
  const createdIds: string[] = [];

  beforeEach(() => {
    vi.mocked(getAuthSession).mockResolvedValue({
      user: { id: ownerId, email: "test@example.com", name: "Test User" },
      scope: { scope: "user", ownerId },
    });
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.workspace.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("returns a JSON-serializable workspace summary", async () => {
    const response = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Design system" }),
      })
    );

    expect(response.status).toBe(201);

    const payload = (await response.json()) as {
      workspace?: { id: string; name: string; slug: string };
    };

    expect(payload.workspace).toMatchObject({
      name: "Design system",
      slug: "design-system",
    });
    expect(() => JSON.stringify(payload)).not.toThrow();

    if (payload.workspace?.id) {
      createdIds.push(payload.workspace.id);
    }
  });
});
