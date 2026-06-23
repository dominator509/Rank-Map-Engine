import type { GeoAeoScoreLabel } from "./constants.js";

export interface GeoAeoScoreInputs {
  brandMentionCoverage?: number | null;
  citationCoverage?: number | null;
  promptIntentCoverage?: number | null;
  competitorGapOpportunity?: number | null;
  entityClarityScore?: number | null;
  schemaReadinessScore?: number | null;
  sourceAuthorityReadiness?: number | null;
  accuracyRiskScore?: number | null;
}

export interface GeoAeoVisibilityScoreResult {
  score: number;
  label: GeoAeoScoreLabel;
  normalizedInputs: NormalizedGeoAeoScoreInputs;
  contributions: Record<keyof GeoAeoScoreInputs, number>;
  explanations: string[];
}

type NormalizedGeoAeoScoreInputs = {
  [Key in keyof GeoAeoScoreInputs]: number;
};

const WEIGHTS: Record<keyof GeoAeoScoreInputs, number> = {
  brandMentionCoverage: 0.2,
  citationCoverage: 0.2,
  promptIntentCoverage: 0.15,
  competitorGapOpportunity: 0.15,
  entityClarityScore: 0.1,
  schemaReadinessScore: 0.1,
  sourceAuthorityReadiness: 0.1,
  accuracyRiskScore: -0.1,
};

function clampToPercent(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getGeoAeoScoreLabel(score: number): GeoAeoScoreLabel {
  const normalized = clampToPercent(score);
  if (normalized >= 90) return "AI Visibility Leader";
  if (normalized >= 75) return "Strong AI Presence";
  if (normalized >= 60) return "Emerging AI Presence";
  if (normalized >= 40) return "At Risk";
  return "Invisible / Competitor-Owned";
}

export function calculateGeoAeoVisibilityScore(
  inputs: GeoAeoScoreInputs,
): GeoAeoVisibilityScoreResult {
  const normalizedInputs: NormalizedGeoAeoScoreInputs = {
    brandMentionCoverage: clampToPercent(inputs.brandMentionCoverage),
    citationCoverage: clampToPercent(inputs.citationCoverage),
    promptIntentCoverage: clampToPercent(inputs.promptIntentCoverage),
    competitorGapOpportunity: clampToPercent(inputs.competitorGapOpportunity),
    entityClarityScore: clampToPercent(inputs.entityClarityScore),
    schemaReadinessScore: clampToPercent(inputs.schemaReadinessScore),
    sourceAuthorityReadiness: clampToPercent(inputs.sourceAuthorityReadiness),
    accuracyRiskScore: clampToPercent(inputs.accuracyRiskScore),
  };

  const contributions = Object.fromEntries(
    Object.entries(normalizedInputs).map(([key, value]) => [
      key,
      roundScore(value * WEIGHTS[key as keyof GeoAeoScoreInputs]),
    ]),
  ) as Record<keyof GeoAeoScoreInputs, number>;

  const rawScore = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const score = roundScore(clampToPercent(rawScore));

  const explanations = [
    `Brand mention coverage contributed ${contributions.brandMentionCoverage} points.`,
    `Citation coverage contributed ${contributions.citationCoverage} points.`,
    `Prompt intent coverage contributed ${contributions.promptIntentCoverage} points.`,
    `Competitor gap opportunity contributed ${contributions.competitorGapOpportunity} points.`,
    `Entity clarity contributed ${contributions.entityClarityScore} points.`,
    `Schema readiness contributed ${contributions.schemaReadinessScore} points.`,
    `Source authority readiness contributed ${contributions.sourceAuthorityReadiness} points.`,
    `Accuracy risk adjusted the score by ${contributions.accuracyRiskScore} points.`,
  ];

  return {
    score,
    label: getGeoAeoScoreLabel(score),
    normalizedInputs,
    contributions,
    explanations,
  };
}
