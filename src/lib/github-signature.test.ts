import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubSignature } from "./github-signature";

describe("verifyGitHubSignature", () => {
  it("accepts a matching SHA-256 signature", () => {
    const payload = '{"action":"push"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(payload).digest("hex")}`;

    expect(verifyGitHubSignature("secret", payload, signature)).toBe(true);
  });

  it("rejects missing, malformed, or mismatched signatures", () => {
    expect(verifyGitHubSignature("secret", "payload", null)).toBe(false);
    expect(verifyGitHubSignature("secret", "payload", "sha1=deadbeef")).toBe(false);
    expect(verifyGitHubSignature("secret", "payload", `sha256=${"0".repeat(64)}`)).toBe(false);
  });
});
