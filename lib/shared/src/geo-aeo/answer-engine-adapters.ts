import { z } from "zod";
import { geoAeoEngineSchema, geoAeoCaptureMethodSchema } from "./schemas.js";

export type GeoAeoAnswerEngineAdapterKey =
  | "manual_snapshot"
  | "csv_snapshot"
  | "mock_answer_engine"
  | "chatgpt_manual"
  | "gemini_manual_or_api_scaffold"
  | "perplexity_api_scaffold"
  | "google_ai_overviews_manual";

export type GeoAeoTermsRiskLevel = "low" | "medium" | "high";

export const geoAeoAdapterConfigSchema = z.object({
  enabled: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export const geoAeoSnapshotNormalizationInputSchema = z.object({
  promptText: z.string().min(1),
  answerText: z.string().min(1),
  engine: geoAeoEngineSchema,
  captureMethod: geoAeoCaptureMethodSchema,
  capturedAt: z.string().datetime().optional(),
  citationUrls: z.array(z.string().url()).default([]),
});

export type GeoAeoSnapshotNormalizationInput = z.input<
  typeof geoAeoSnapshotNormalizationInputSchema
>;

export interface GeoAeoNormalizedSnapshot {
  promptText: string;
  answerText: string;
  engine: z.infer<typeof geoAeoEngineSchema>;
  captureMethod: z.infer<typeof geoAeoCaptureMethodSchema>;
  capturedAt: string;
  citationUrls: string[];
  normalizedAt: string;
}

export interface GeoAeoAdapterHealth {
  ok: boolean;
  status: "available" | "manual_only" | "disabled" | "unconfigured";
  message: string;
}

export interface GeoAeoAnswerEngineAdapter {
  registryKey: GeoAeoAnswerEngineAdapterKey;
  name: string;
  displayName: string;
  featureFlag: string;
  supportsDirectQuery: boolean;
  supportsManualSnapshot: boolean;
  supportsCsvImport: boolean;
  supportsCitationExtraction: boolean;
  requiresApiKey: boolean;
  termsRiskLevel: GeoAeoTermsRiskLevel;
  configSchema: typeof geoAeoAdapterConfigSchema;
  secretFields: string[];
  healthCheck: () => GeoAeoAdapterHealth;
  normalizeSnapshot: (input: GeoAeoSnapshotNormalizationInput) => GeoAeoNormalizedSnapshot;
  mockImplementation: (promptText: string) => GeoAeoNormalizedSnapshot;
  errorNormalizer: (error: unknown) => { message: string; retryable: boolean };
  timeoutPolicy: {
    timeoutMs: number;
    retries: number;
  };
}

function normalizeSnapshot(input: GeoAeoSnapshotNormalizationInput): GeoAeoNormalizedSnapshot {
  const parsed = geoAeoSnapshotNormalizationInputSchema.parse(input);
  const now = new Date().toISOString();

  return {
    promptText: parsed.promptText,
    answerText: parsed.answerText,
    engine: parsed.engine,
    captureMethod: parsed.captureMethod,
    capturedAt: parsed.capturedAt ?? now,
    citationUrls: parsed.citationUrls,
    normalizedAt: now,
  };
}

function mockSnapshot(promptText: string): GeoAeoNormalizedSnapshot {
  return normalizeSnapshot({
    promptText,
    answerText:
      "Mock answer-engine snapshot for local GEO/AEO testing. Replace with a manual pasted answer before client delivery.",
    engine: "other",
    captureMethod: "mock_adapter",
  });
}

function normalizeError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof Error) {
    return { message: error.message, retryable: false };
  }
  return { message: "Unknown answer-engine adapter error", retryable: false };
}

function manualHealth(displayName: string): GeoAeoAdapterHealth {
  return {
    ok: true,
    status: "manual_only",
    message: `${displayName} is available for manual/mock snapshot collection.`,
  };
}

function createAdapter(
  adapter: Omit<
    GeoAeoAnswerEngineAdapter,
    "configSchema" | "healthCheck" | "normalizeSnapshot" | "mockImplementation" | "errorNormalizer"
  >,
): GeoAeoAnswerEngineAdapter {
  return {
    ...adapter,
    configSchema: geoAeoAdapterConfigSchema,
    healthCheck: () => manualHealth(adapter.displayName),
    normalizeSnapshot,
    mockImplementation: mockSnapshot,
    errorNormalizer: normalizeError,
  };
}

export const GEO_AEO_ANSWER_ENGINE_ADAPTERS: GeoAeoAnswerEngineAdapter[] = [
  createAdapter({
    registryKey: "manual_snapshot",
    name: "manual_snapshot",
    displayName: "Manual Snapshot",
    featureFlag: "MANUAL_GEO_AEO_SNAPSHOTS_ENABLED",
    supportsDirectQuery: false,
    supportsManualSnapshot: true,
    supportsCsvImport: false,
    supportsCitationExtraction: true,
    requiresApiKey: false,
    termsRiskLevel: "low",
    secretFields: [],
    timeoutPolicy: { timeoutMs: 0, retries: 0 },
  }),
  createAdapter({
    registryKey: "csv_snapshot",
    name: "csv_snapshot",
    displayName: "CSV Snapshot Import",
    featureFlag: "MANUAL_GEO_AEO_SNAPSHOTS_ENABLED",
    supportsDirectQuery: false,
    supportsManualSnapshot: false,
    supportsCsvImport: true,
    supportsCitationExtraction: true,
    requiresApiKey: false,
    termsRiskLevel: "low",
    secretFields: [],
    timeoutPolicy: { timeoutMs: 0, retries: 0 },
  }),
  createAdapter({
    registryKey: "mock_answer_engine",
    name: "mock_answer_engine",
    displayName: "Mock Answer Engine",
    featureFlag: "MOCK_ANSWER_ENGINE_ENABLED",
    supportsDirectQuery: false,
    supportsManualSnapshot: true,
    supportsCsvImport: false,
    supportsCitationExtraction: true,
    requiresApiKey: false,
    termsRiskLevel: "low",
    secretFields: [],
    timeoutPolicy: { timeoutMs: 1000, retries: 0 },
  }),
  createAdapter({
    registryKey: "chatgpt_manual",
    name: "chatgpt_manual",
    displayName: "ChatGPT Manual",
    featureFlag: "CHATGPT_VISIBILITY_MANUAL_ONLY",
    supportsDirectQuery: false,
    supportsManualSnapshot: true,
    supportsCsvImport: false,
    supportsCitationExtraction: true,
    requiresApiKey: false,
    termsRiskLevel: "medium",
    secretFields: [],
    timeoutPolicy: { timeoutMs: 0, retries: 0 },
  }),
  createAdapter({
    registryKey: "gemini_manual_or_api_scaffold",
    name: "gemini_manual_or_api_scaffold",
    displayName: "Gemini Manual/API Scaffold",
    featureFlag: "GEMINI_VISIBILITY_ENABLED",
    supportsDirectQuery: false,
    supportsManualSnapshot: true,
    supportsCsvImport: false,
    supportsCitationExtraction: true,
    requiresApiKey: false,
    termsRiskLevel: "medium",
    secretFields: [],
    timeoutPolicy: { timeoutMs: 15000, retries: 1 },
  }),
  createAdapter({
    registryKey: "perplexity_api_scaffold",
    name: "perplexity_api_scaffold",
    displayName: "Perplexity API Scaffold",
    featureFlag: "PERPLEXITY_ENABLED",
    supportsDirectQuery: false,
    supportsManualSnapshot: true,
    supportsCsvImport: false,
    supportsCitationExtraction: true,
    requiresApiKey: true,
    termsRiskLevel: "medium",
    secretFields: ["PERPLEXITY_API_KEY"],
    timeoutPolicy: { timeoutMs: 15000, retries: 1 },
  }),
  createAdapter({
    registryKey: "google_ai_overviews_manual",
    name: "google_ai_overviews_manual",
    displayName: "Google AI Overviews Manual",
    featureFlag: "GOOGLE_AI_OVERVIEWS_MANUAL_ONLY",
    supportsDirectQuery: false,
    supportsManualSnapshot: true,
    supportsCsvImport: false,
    supportsCitationExtraction: true,
    requiresApiKey: false,
    termsRiskLevel: "high",
    secretFields: [],
    timeoutPolicy: { timeoutMs: 0, retries: 0 },
  }),
];

export function getGeoAeoAnswerEngineAdapter(
  registryKey: GeoAeoAnswerEngineAdapterKey,
): GeoAeoAnswerEngineAdapter {
  const adapter = GEO_AEO_ANSWER_ENGINE_ADAPTERS.find((item) => item.registryKey === registryKey);
  if (!adapter) {
    throw new Error(`Unknown GEO/AEO answer-engine adapter: ${registryKey}`);
  }
  return adapter;
}
