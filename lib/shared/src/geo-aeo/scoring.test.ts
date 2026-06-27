import { describe, expect, it } from "vitest";
import { neutralizeCsvCell, parseCsvObjects } from "./csv.js";
import { validateGeoAeoEnv } from "./env.js";
import { calculateGeoAeoVisibilityScore, getGeoAeoScoreLabel } from "./scoring.js";
import { geoAeoPromptCreateSchema, geoAeoSnapshotCreateSchema } from "./schemas.js";

describe("GEO/AEO scoring", () => {
  it("calculates the weighted score from normalized inputs", () => {
    const result = calculateGeoAeoVisibilityScore({
      brandMentionCoverage: 80,
      citationCoverage: 70,
      promptIntentCoverage: 60,
      competitorGapOpportunity: 50,
      entityClarityScore: 90,
      schemaReadinessScore: 40,
      sourceAuthorityReadiness: 30,
      accuracyRiskScore: 20,
    });

    expect(result.score).toBe(60.5);
    expect(result.label).toBe("Emerging AI Presence");
    expect(result.explanations).toHaveLength(8);
  });

  it("clamps inputs and final output to 0-100", () => {
    const result = calculateGeoAeoVisibilityScore({
      brandMentionCoverage: 200,
      citationCoverage: Number.POSITIVE_INFINITY,
      promptIntentCoverage: 100,
      competitorGapOpportunity: -25,
      entityClarityScore: 100,
      schemaReadinessScore: 100,
      sourceAuthorityReadiness: 100,
      accuracyRiskScore: -10,
    });

    expect(result.normalizedInputs.brandMentionCoverage).toBe(100);
    expect(result.normalizedInputs.citationCoverage).toBe(0);
    expect(result.normalizedInputs.competitorGapOpportunity).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("labels score bands at their thresholds", () => {
    expect(getGeoAeoScoreLabel(90)).toBe("AI Visibility Leader");
    expect(getGeoAeoScoreLabel(75)).toBe("Strong AI Presence");
    expect(getGeoAeoScoreLabel(60)).toBe("Emerging AI Presence");
    expect(getGeoAeoScoreLabel(40)).toBe("At Risk");
    expect(getGeoAeoScoreLabel(39.99)).toBe("Invisible / Competitor-Owned");
  });
});

describe("GEO/AEO shared validation", () => {
  it("keeps manual/mock defaults valid and real calls disabled", () => {
    const result = validateGeoAeoEnv({
      GEO_AEO_ENABLED: "true",
      MOCK_ANSWER_ENGINE_ENABLED: "true",
      MANUAL_GEO_AEO_SNAPSHOTS_ENABLED: "true",
      REAL_ANSWER_ENGINE_CALLS_ENABLED: "false",
      GOOGLE_AI_OVERVIEWS_MANUAL_ONLY: "true",
      CHATGPT_VISIBILITY_MANUAL_ONLY: "true",
    });

    expect(result.ok).toBe(true);
    expect(result.env.realAnswerEngineCallsEnabled).toBe(false);
  });

  it("rejects unsafe direct answer-engine modes", () => {
    const result = validateGeoAeoEnv({
      GEO_AEO_ENABLED: "true",
      GOOGLE_AI_OVERVIEWS_MANUAL_ONLY: "false",
      CHATGPT_VISIBILITY_MANUAL_ONLY: "false",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Google AI Overviews collection must remain manual/mock only.",
        "ChatGPT visibility collection must remain manual/mock unless an approved path exists.",
      ]),
    );
  });

  it("requires a Perplexity key only for enabled real calls", () => {
    const result = validateGeoAeoEnv({
      REAL_ANSWER_ENGINE_CALLS_ENABLED: "true",
      PERPLEXITY_ENABLED: "true",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "PERPLEXITY_API_KEY is required when Perplexity real calls are enabled.",
    );
  });

  it("validates prompt and snapshot inputs", () => {
    expect(
      geoAeoPromptCreateSchema.parse({
        auditId: 1,
        promptText: "Who is the best emergency plumber in Austin?",
      }),
    ).toMatchObject({ auditId: 1, priority: 50 });

    expect(
      geoAeoSnapshotCreateSchema.safeParse({
        auditId: 1,
        promptId: 1,
        engine: "chatgpt",
        captureMethod: "manual_paste",
        answerText: "A pasted answer snapshot.",
      }).success,
    ).toBe(true);
  });

  it("neutralizes spreadsheet formula cells", () => {
    expect(neutralizeCsvCell('=IMPORTXML("https://example.test")')).toBe(
      '\'=IMPORTXML("https://example.test")',
    );
    expect(neutralizeCsvCell("normal text")).toBe("normal text");
  });

  it("parses quoted CSV objects and neutralizes imported cells", () => {
    const rows = parseCsvObjects(
      'promptText,intent\n"Best plumbers, Austin",commercial\n"=IMPORTXML(""https://example.test"")",informational',
    );

    expect(rows).toEqual([
      { promptText: "Best plumbers, Austin", intent: "commercial" },
      { promptText: '\'=IMPORTXML("https://example.test")', intent: "informational" },
    ]);
  });
});
