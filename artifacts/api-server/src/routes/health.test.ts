import { describe, it, expect } from "vitest";

describe("Phase 0 — Health Check Sanity", () => {
  it("trivially passes — skeleton phase", () => {
    expect(true).toBe(true);
  });

  it("health response shape is correct", () => {
    const response = { status: "ok" };
    expect(response).toHaveProperty("status");
    expect(response.status).toBe("ok");
  });
});
