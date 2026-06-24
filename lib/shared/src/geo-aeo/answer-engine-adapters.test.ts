import { describe, expect, it } from "vitest";
import {
  GEO_AEO_ANSWER_ENGINE_ADAPTERS,
  getGeoAeoAnswerEngineAdapter,
} from "./answer-engine-adapters.js";

describe("GEO/AEO answer-engine adapter registry", () => {
  it("registers every required adapter", () => {
    expect(GEO_AEO_ANSWER_ENGINE_ADAPTERS.map((adapter) => adapter.registryKey)).toEqual([
      "manual_snapshot",
      "csv_snapshot",
      "mock_answer_engine",
      "chatgpt_manual",
      "gemini_manual_or_api_scaffold",
      "perplexity_api_scaffold",
      "google_ai_overviews_manual",
    ]);
  });

  it("keeps direct provider queries disabled in this scaffold", () => {
    expect(GEO_AEO_ANSWER_ENGINE_ADAPTERS.every((adapter) => !adapter.supportsDirectQuery)).toBe(
      true,
    );
  });

  it("normalizes manual snapshots without provider calls", () => {
    const adapter = getGeoAeoAnswerEngineAdapter("manual_snapshot");
    const normalized = adapter.normalizeSnapshot({
      promptText: "Who should I hire for emergency plumbing in Austin?",
      answerText: "Example answer",
      engine: "chatgpt",
      captureMethod: "manual_paste",
    });

    expect(normalized).toMatchObject({
      promptText: "Who should I hire for emergency plumbing in Austin?",
      answerText: "Example answer",
      engine: "chatgpt",
      captureMethod: "manual_paste",
      citationUrls: [],
    });
  });

  it("marks Google AI Overviews as manual-only high terms risk", () => {
    const adapter = getGeoAeoAnswerEngineAdapter("google_ai_overviews_manual");

    expect(adapter.supportsDirectQuery).toBe(false);
    expect(adapter.termsRiskLevel).toBe("high");
    expect(adapter.requiresApiKey).toBe(false);
  });
});
