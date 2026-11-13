import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubSignature(
  secret: string,
  payload: string,
  signature: string | null,
): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const provided = Buffer.from(signature.slice("sha256=".length), "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
