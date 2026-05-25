import { afterEach, describe, expect, it, vi } from "vitest";
import { clusterKeywordsWithAI, generateBriefWithAI } from "./ai-provider.js";

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

describe("ai-provider", () => {
  it("uses mock clustering when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await clusterKeywordsWithAI([
      { id: 1, phrase: "seo strategy guide" },
      { id: 2, phrase: "seo checklist" },
      { id: 3, phrase: "content brief template" },
    ]);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((cluster) => cluster.label === "seo")).toBe(true);
  });

  it("parses openai cluster response and filters invalid cluster rows", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://example.test/v1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  clusters: [
                    { label: "valid", keywordIds: [1, 2] },
                    { label: 123, keywordIds: [3] },
                  ],
                }),
              },
            },
          ],
        }),
      }),
    );

    const result = await clusterKeywordsWithAI([{ id: 1, phrase: "seo" }]);
    expect(result).toEqual([{ label: "valid", keywordIds: [1, 2] }]);
  });

  it("falls back to mock clustering when openai call fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream timeout")));

    const result = await clusterKeywordsWithAI([
      { id: 1, phrase: "analytics dashboard" },
      { id: 2, phrase: "analytics report" },
    ]);
    expect(result).toEqual([{ label: "analytics", keywordIds: [1, 2] }]);
  });

  it("returns mock brief when openai output shape is invalid", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ notSections: true }) } }],
        }),
      }),
    );

    const result = await generateBriefWithAI("RankMap Guide", "SEO", [
      "rank map",
      "seo strategy",
      "keyword clustering",
    ]);

    expect(result.sections.length).toBeGreaterThanOrEqual(4);
    expect(result.targetKeywords).toEqual(["rank map", "seo strategy", "keyword clustering"]);
  });
});
