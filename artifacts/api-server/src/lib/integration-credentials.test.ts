import { afterEach, describe, expect, it } from "vitest";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
  isEncryptedIntegrationCredentials,
  normalizeIntegrationCredentials,
} from "./integration-credentials.js";

const originalKey = process.env.INTEGRATION_CREDENTIALS_KEY;
const originalSessionSecret = process.env.SESSION_SECRET;

afterEach(() => {
  if (originalKey === undefined) delete process.env.INTEGRATION_CREDENTIALS_KEY;
  else process.env.INTEGRATION_CREDENTIALS_KEY = originalKey;

  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSessionSecret;
});

describe("integration-credentials", () => {
  it("normalizes credential records and rejects malformed values", () => {
    expect(normalizeIntegrationCredentials({ apiKey: "abc", login: "demo" })).toEqual({
      apiKey: "abc",
      login: "demo",
    });
    expect(normalizeIntegrationCredentials({ apiKey: 123 })).toBeNull();
    expect(normalizeIntegrationCredentials(["x"])).toBeNull();
    expect(normalizeIntegrationCredentials(null)).toBeNull();
  });

  it("round-trips encrypted credentials with explicit encryption key", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const input = { apiKey: "secret", account: "acct_1" };
    const encrypted = encryptIntegrationCredentials(input);
    expect(isEncryptedIntegrationCredentials(encrypted)).toBe(true);

    const decrypted = decryptIntegrationCredentials(encrypted);
    expect(decrypted).toEqual(input);
  });

  it("accepts plaintext credentials for backward compatibility", () => {
    expect(decryptIntegrationCredentials({ apiKey: "legacy-secret" })).toEqual({
      apiKey: "legacy-secret",
    });
    expect(decryptIntegrationCredentials(undefined)).toEqual({});
  });

  it("falls back to session secret when dedicated key is not set", () => {
    delete process.env.INTEGRATION_CREDENTIALS_KEY;
    process.env.SESSION_SECRET = "session-secret-with-at-least-32-characters";

    const encrypted = encryptIntegrationCredentials({ token: "abc" });
    expect(decryptIntegrationCredentials(encrypted)).toEqual({ token: "abc" });
  });
});
