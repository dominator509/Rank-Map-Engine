import { describe, expect, it } from "vitest";
import { apiKeyScopesAllowMethod, normalizeApiKeyScopes } from "./api-key-scopes.js";

describe("api-key-scopes", () => {
  it("normalizes valid scope payloads", () => {
    expect(normalizeApiKeyScopes(["read", "write"])).toEqual(["read", "write"]);
    expect(normalizeApiKeyScopes(["read", "read"])).toEqual(["read"]);
  });

  it("fails closed for malformed scope payloads during enforcement", () => {
    expect(apiKeyScopesAllowMethod(["oops"], "GET")).toBe(false);
    expect(apiKeyScopesAllowMethod(["oops"], "POST")).toBe(false);
  });

  it("enforces read/write semantics for valid scope payloads", () => {
    expect(apiKeyScopesAllowMethod(["read"], "GET")).toBe(true);
    expect(apiKeyScopesAllowMethod(["read"], "POST")).toBe(false);
    expect(apiKeyScopesAllowMethod(["write"], "POST")).toBe(true);
    expect(apiKeyScopesAllowMethod(["write"], "GET")).toBe(false);
  });
});
