import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchKeywordsFromProvider } from "./keyword-adapters.js";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
});

describe("keyword-adapters", () => {
  it("returns empty array for unsupported provider variants", async () => {
    const result = await fetchKeywordsFromProvider("manual", "seo", {});
    expect(result).toEqual([]);
  });

  it("returns deterministic fallback when provider credentials are missing", async () => {
    const result = await fetchKeywordsFromProvider("ahrefs", "SEO Strategy", {});
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.phrase).toContain("seo strategy");
  });

  it("parses semrush csv response when query auth is enabled", async () => {
    process.env.FEATURE_SEMRUSH_IMPORT = "true";
    process.env.ALLOW_SEMRUSH_QUERY_AUTH = "true";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "Ph;Nq;Cp;Kd\nkeyword one;100;1.23;45\nkeyword two;250;0.75;34",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchKeywordsFromProvider("semrush", "seed", { apiKey: "sem_key" });
    expect(result).toEqual([
      { phrase: "keyword one", searchVolume: 100, cpc: 1.23, kd: 45 },
      { phrase: "keyword two", searchVolume: 250, cpc: 0.75, kd: 34 },
    ]);
  });

  it("drops partial numeric coercions in semrush csv rows", async () => {
    process.env.FEATURE_SEMRUSH_IMPORT = "true";
    process.env.ALLOW_SEMRUSH_QUERY_AUTH = "true";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "Ph;Nq;Cp;Kd\nkeyword one;1e2;1e2;1.23abc",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchKeywordsFromProvider("semrush", "seed", { apiKey: "sem_key" });
    expect(result).toEqual([
      { phrase: "keyword one", searchVolume: undefined, cpc: undefined, kd: undefined },
    ]);
  });

  it("falls back when semrush query-string auth is disabled", async () => {
    process.env.FEATURE_SEMRUSH_IMPORT = "true";
    process.env.ALLOW_SEMRUSH_QUERY_AUTH = "false";
    const result = await fetchKeywordsFromProvider("semrush", "seed", { apiKey: "sem_key" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((row) => row.phrase.includes("seed"))).toBe(true);
  });

  it("maps dataforseo response and falls back on fetch failure", async () => {
    process.env.FEATURE_DATAFORSEO_IMPORT = "true";
    const okFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [
          {
            result: [
              {
                keyword: "rank map",
                search_volume: 900,
                cpc: 2.2,
                competition_index: 61.2,
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", okFetch);

    const mapped = await fetchKeywordsFromProvider("dataforseo", "rank map", {
      login: "demo",
      password: "demo_pass",
    });
    expect(mapped).toEqual([{ phrase: "rank map", searchVolume: 900, cpc: 2.2, kd: 61 }]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failure for deterministic test")),
    );
    const fallback = await fetchKeywordsFromProvider("dataforseo", "rank map", {
      login: "demo",
      password: "demo_pass",
    });
    expect(fallback.length).toBeGreaterThan(0);
  });
});
