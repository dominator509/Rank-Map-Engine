import { describe, expect, it } from "vitest";
import { HealthCheckResponse } from "@workspace/api-zod";

describe("health check contract", () => {
  it("accepts the canonical liveness response shape", () => {
    expect(HealthCheckResponse.parse({ status: "ok" })).toEqual({ status: "ok" });
  });

  it("rejects non-canonical liveness states", () => {
    expect(() => HealthCheckResponse.parse({ status: "degraded" })).toThrow();
  });
});
