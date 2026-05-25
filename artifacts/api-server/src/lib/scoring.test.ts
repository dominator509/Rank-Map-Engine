import { describe, expect, it, vi } from "vitest";
import { computeScore, defaultSettings } from "./scoring.js";

describe("scoring", () => {
  it("returns defaults with expected weight strings", () => {
    expect(defaultSettings()).toEqual({
      volumeWeight: "0.30",
      kdWeight: "0.25",
      intentWeight: "0.20",
      cpcWeight: "0.15",
      freshnessWeight: "0.10",
    });
  });

  it("computes bounded scores with nullish inputs", () => {
    const result = computeScore(
      {
        searchVolume: null,
        kd: null,
        cpc: null,
        intent: null,
      },
      defaultSettings(),
    );

    expect(result.rawScore).toBeGreaterThanOrEqual(0);
    expect(result.rawScore).toBeLessThanOrEqual(1);
    expect(result.finalScore).toBe(Math.round(result.rawScore * 100) / 100);
  });

  it("handles unknown intent and extreme metric boundaries", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const result = computeScore(
      {
        searchVolume: 50_000,
        kd: -20,
        cpc: 200,
        intent: "unknown-intent",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      defaultSettings(),
    );

    expect(result.rawScore).toBeGreaterThanOrEqual(0);
    expect(result.rawScore).toBeLessThanOrEqual(1.5);
    expect(result.finalScore).toBe(Math.round(result.rawScore * 100) / 100);

    vi.useRealTimers();
  });

  it("reduces freshness contribution for old content", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const fresh = computeScore(
      {
        searchVolume: 1000,
        kd: 40,
        cpc: 2,
        intent: "commercial",
        createdAt: new Date("2025-12-31T00:00:00.000Z"),
      },
      defaultSettings(),
    );

    const stale = computeScore(
      {
        searchVolume: 1000,
        kd: 40,
        cpc: 2,
        intent: "commercial",
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      },
      defaultSettings(),
    );

    expect(fresh.rawScore).toBeGreaterThan(stale.rawScore);
    vi.useRealTimers();
  });
});
