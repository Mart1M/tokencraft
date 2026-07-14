import { describe, expect, it } from "vitest";

import { readJsonResponse } from "@/lib/api/read-json-response";

describe("readJsonResponse", () => {
  it("surfaces auth redirects instead of treating HTML as success", async () => {
    const response = new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    Object.defineProperty(response, "redirected", { value: true });

    await expect(readJsonResponse(response)).resolves.toEqual({
      error: "Authentication required. Refresh the page and try again.",
    });
  });

  it("returns parsed JSON payloads", async () => {
    const response = new Response(JSON.stringify({ workspace: { id: "ws_1" } }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

    await expect(readJsonResponse<{ workspace?: { id: string } }>(response)).resolves.toEqual({
      data: { workspace: { id: "ws_1" } },
    });
  });
});
