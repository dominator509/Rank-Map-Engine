import type { ProjectScoreSettings } from "@workspace/db";

export interface KeywordMetrics {
  searchVolume?: number | null;
  kd?: number | null;
  cpc?: number | null;
  intent?: string | null;
  createdAt?: Date;
}

const INTENT_SCORE: Record<string, number> = {
  transactional: 1.0,
  commercial: 0.8,
  navigational: 0.5,
  informational: 0.3,
};

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function freshnessScore(createdAt?: Date): number {
  if (!createdAt) return 0;
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / 86_400_000;
  return Math.max(0, 1 - ageDays / 365);
}

export function computeScore(
  keyword: KeywordMetrics,
  settings: Pick<
    ProjectScoreSettings,
    "volumeWeight" | "kdWeight" | "intentWeight" | "cpcWeight" | "freshnessWeight"
  >,
): { rawScore: number; finalScore: number } {
  const wVol = parseFloat(settings.volumeWeight);
  const wKd = parseFloat(settings.kdWeight);
  const wIntent = parseFloat(settings.intentWeight);
  const wCpc = parseFloat(settings.cpcWeight);
  const wFreshness = parseFloat(settings.freshnessWeight);

  const volScore = normalize(keyword.searchVolume ?? 0, 0, 10000);
  const kdScore = 1 - normalize(keyword.kd ?? 50, 0, 100);
  const intentScore = INTENT_SCORE[keyword.intent ?? "informational"] ?? 0.3;
  const cpcScore = normalize(keyword.cpc ?? 0, 0, 20);
  const fresh = freshnessScore(keyword.createdAt);

  const raw =
    wVol * volScore + wKd * kdScore + wIntent * intentScore + wCpc * cpcScore + wFreshness * fresh;

  const final = Math.round(raw * 100) / 100;

  return { rawScore: raw, finalScore: final };
}

export function defaultSettings(): Pick<
  ProjectScoreSettings,
  "volumeWeight" | "kdWeight" | "intentWeight" | "cpcWeight" | "freshnessWeight"
> {
  return {
    volumeWeight: "0.30",
    kdWeight: "0.25",
    intentWeight: "0.20",
    cpcWeight: "0.15",
    freshnessWeight: "0.10",
  };
}
