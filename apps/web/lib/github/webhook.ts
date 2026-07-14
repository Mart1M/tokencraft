import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubSignature({
  payload,
  signature,
  secret
}: {
  payload: string;
  signature: string | null;
  secret: string;
}) {
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
