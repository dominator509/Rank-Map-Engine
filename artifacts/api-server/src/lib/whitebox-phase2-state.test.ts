import { describe, expect, it } from "vitest";
import { hasControlChars, withinWhiteLabelLimits } from "./input-guards.js";
import { normalizeApiKeyScopes, apiKeyScopesAllowMethod } from "./api-key-scopes.js";
import {
  encryptIntegrationCredentials,
  decryptIntegrationCredentials,
  isEncryptedIntegrationCredentials,
} from "./integration-credentials.js";

function deeplyNested(depth: number): unknown {
  let current: Record<string, unknown> = { leaf: true };
  for (let i = 0; i < depth; i += 1) {
    current = { nested: current };
  }
  return current;
}

describe("whitebox phase2 state tracking", () => {
  it("tracks control-char detection across safe and unsafe email inputs", () => {
    expect(hasControlChars("safe.user@example.com")).toBe(false);
    expect(hasControlChars("bad\u0000user@example.com")).toBe(true);
    expect(hasControlChars("bad\u001Fuser@example.com")).toBe(true);
    expect(hasControlChars("bad\u007Fuser@example.com")).toBe(true);
  });

  it("enforces white-label depth bounds and preserves shallow structure allowance", () => {
    expect(withinWhiteLabelLimits({ a: { b: { c: 1 } } })).toBe(true);
    expect(withinWhiteLabelLimits(deeplyNested(20))).toBe(false);
    expect(withinWhiteLabelLimits(deeplyNested(3))).toBe(true);
  });

  it("normalizes API-key scopes and drives method authorization state", () => {
    const normalized = normalizeApiKeyScopes(["read", "write", "read"], { allowEmpty: true });
    expect(normalized).toEqual(["read", "write"]);
    expect(apiKeyScopesAllowMethod(normalized ?? [], "GET")).toBe(true);
    expect(apiKeyScopesAllowMethod(["read"], "POST")).toBe(false);
  });

  it("round-trips integration credential envelope and preserves internal envelope markers", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const input = { token: "secret-token", account: "acct_123" };
    const encrypted = encryptIntegrationCredentials(input);
    expect(isEncryptedIntegrationCredentials(encrypted)).toBe(true);

    // Assert intermediate envelope structure, not just final decrypt result.
    expect(encrypted.v).toBe(1);
    expect(encrypted.alg).toBe("aes-256-gcm");
    expect(typeof encrypted.iv).toBe("string");
    expect(typeof encrypted.tag).toBe("string");
    expect(typeof encrypted.ciphertext).toBe("string");

    const decrypted = decryptIntegrationCredentials(encrypted);
    expect(decrypted).toEqual(input);
  });
});
