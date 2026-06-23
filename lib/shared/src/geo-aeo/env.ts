export interface GeoAeoEnvInput {
  GEO_AEO_ENABLED?: string;
  MOCK_ANSWER_ENGINE_ENABLED?: string;
  REAL_ANSWER_ENGINE_CALLS_ENABLED?: string;
  MANUAL_GEO_AEO_SNAPSHOTS_ENABLED?: string;
  GOOGLE_AI_OVERVIEWS_MANUAL_ONLY?: string;
  PERPLEXITY_ENABLED?: string;
  PERPLEXITY_API_KEY?: string;
  GEMINI_VISIBILITY_ENABLED?: string;
  CHATGPT_VISIBILITY_MANUAL_ONLY?: string;
  AI_VISIBILITY_MONTHLY_MONITORING_ENABLED?: string;
}

export interface GeoAeoEnv {
  geoAeoEnabled: boolean;
  mockAnswerEngineEnabled: boolean;
  realAnswerEngineCallsEnabled: boolean;
  manualGeoAeoSnapshotsEnabled: boolean;
  googleAiOverviewsManualOnly: boolean;
  perplexityEnabled: boolean;
  geminiVisibilityEnabled: boolean;
  chatgptVisibilityManualOnly: boolean;
  aiVisibilityMonthlyMonitoringEnabled: boolean;
}

export interface GeoAeoEnvValidationResult {
  ok: boolean;
  env: GeoAeoEnv;
  errors: string[];
}

const TRUE_PATTERN = /^(1|true|yes|on)$/i;
const FALSE_PATTERN = /^(0|false|no|off)$/i;

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = value?.trim();
  if (!normalized) return defaultValue;
  if (TRUE_PATTERN.test(normalized)) return true;
  if (FALSE_PATTERN.test(normalized)) return false;
  return defaultValue;
}

export function validateGeoAeoEnv(input: GeoAeoEnvInput): GeoAeoEnvValidationResult {
  const env: GeoAeoEnv = {
    geoAeoEnabled: parseFlag(input.GEO_AEO_ENABLED, false),
    mockAnswerEngineEnabled: parseFlag(input.MOCK_ANSWER_ENGINE_ENABLED, true),
    realAnswerEngineCallsEnabled: parseFlag(input.REAL_ANSWER_ENGINE_CALLS_ENABLED, false),
    manualGeoAeoSnapshotsEnabled: parseFlag(input.MANUAL_GEO_AEO_SNAPSHOTS_ENABLED, true),
    googleAiOverviewsManualOnly: parseFlag(input.GOOGLE_AI_OVERVIEWS_MANUAL_ONLY, true),
    perplexityEnabled: parseFlag(input.PERPLEXITY_ENABLED, false),
    geminiVisibilityEnabled: parseFlag(input.GEMINI_VISIBILITY_ENABLED, false),
    chatgptVisibilityManualOnly: parseFlag(input.CHATGPT_VISIBILITY_MANUAL_ONLY, true),
    aiVisibilityMonthlyMonitoringEnabled: parseFlag(
      input.AI_VISIBILITY_MONTHLY_MONITORING_ENABLED,
      false,
    ),
  };

  const errors: string[] = [];

  if (env.geoAeoEnabled && !env.mockAnswerEngineEnabled && !env.manualGeoAeoSnapshotsEnabled) {
    errors.push("GEO/AEO requires mock or manual snapshot collection to remain enabled.");
  }

  if (!env.googleAiOverviewsManualOnly) {
    errors.push("Google AI Overviews collection must remain manual/mock only.");
  }

  if (!env.chatgptVisibilityManualOnly) {
    errors.push("ChatGPT visibility collection must remain manual/mock unless an approved path exists.");
  }

  if (env.perplexityEnabled && env.realAnswerEngineCallsEnabled && !input.PERPLEXITY_API_KEY?.trim()) {
    errors.push("PERPLEXITY_API_KEY is required when Perplexity real calls are enabled.");
  }

  if (!env.realAnswerEngineCallsEnabled && env.perplexityEnabled) {
    errors.push("PERPLEXITY_ENABLED requires REAL_ANSWER_ENGINE_CALLS_ENABLED=true.");
  }

  return { ok: errors.length === 0, env, errors };
}
