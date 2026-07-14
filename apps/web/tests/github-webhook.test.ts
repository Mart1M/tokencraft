import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubSignature } from "@/lib/github/webhook";

describe("verifyGitHubSignature", () => {
  it("accepts a valid sha256 signature", () => {
    const payload = JSON.stringify({ action: "created" });
    const secret = "test-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

    expect(verifyGitHubSignature({ payload, signature, secret })).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(
      verifyGitHubSignature({
        payload: "{}",
        signature: "sha256=bad",
        secret: "test-secret"
      })
    ).toBe(false);
  });
});
