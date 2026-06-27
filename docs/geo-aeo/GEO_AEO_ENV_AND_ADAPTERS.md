# GEO/AEO Environment Variables and Adapter Architecture

## 1. Environment Variables

Add to `.env.example` with fake placeholders only:

```txt
GEO_AEO_ENABLED=true
MOCK_ANSWER_ENGINE_ENABLED=true
REAL_ANSWER_ENGINE_CALLS_ENABLED=false
MANUAL_GEO_AEO_SNAPSHOTS_ENABLED=true
GOOGLE_AI_OVERVIEWS_MANUAL_ONLY=true
PERPLEXITY_ENABLED=false
PERPLEXITY_API_KEY=
GEMINI_VISIBILITY_ENABLED=false
CHATGPT_VISIBILITY_MANUAL_ONLY=true
AI_VISIBILITY_MONTHLY_MONITORING_ENABLED=false
```

Optional future flags:

```txt
ANSWER_ENGINE_TIMEOUT_MS=15000
ANSWER_ENGINE_MAX_RETRIES=1
ANSWER_ENGINE_MAX_RESPONSE_BYTES=500000
ANSWER_ENGINE_RATE_LIMIT_ENABLED=true
GEO_AEO_CSV_MAX_ROWS=5000
GEO_AEO_SNAPSHOT_MAX_CHARS=60000
```

## 2. Validation Rules

- `GEO_AEO_ENABLED` may be true in development/mock mode.
- `REAL_ANSWER_ENGINE_CALLS_ENABLED` defaults to false.
- If `REAL_ANSWER_ENGINE_CALLS_ENABLED=true`, each enabled real provider must have required secrets.
- `GOOGLE_AI_OVERVIEWS_MANUAL_ONLY=true` should prevent automated Google AI Overviews collection.
- `PERPLEXITY_API_KEY` is required only when `PERPLEXITY_ENABLED=true` and real calls are enabled.
- No validation should require paid API keys in test mode.

## 3. Adapter Categories

The GEO/AEO module uses two adapter layers:

### AI Provider Adapters

Existing RankMap AI providers analyze text and generate findings:

- OpenAI.
- Anthropic.
- Gemini.
- Groq.
- OpenRouter.
- Mistral.
- Local OpenAI-compatible.
- Ollama.
- Mock AI.

### Answer-Engine Visibility Adapters

New adapters collect or normalize observations from AI answer engines.

Required:

- Manual snapshot adapter.
- CSV snapshot adapter.
- Mock answer-engine adapter.
- ChatGPT manual adapter.
- Gemini manual/API scaffold.
- Perplexity API scaffold.
- Google AI Overviews manual adapter.

Feature services must not call answer engines directly.

## 4. Answer-Engine Adapter Interface

Adapt to the repository’s TypeScript style:

```ts
export interface AnswerEngineAdapter {
  registryKey: string;
  name: string;
  displayName: string;
  featureFlag: string;
  supportsDirectQuery: boolean;
  supportsManualSnapshot: boolean;
  supportsCsvImport: boolean;
  supportsCitationExtraction: boolean;
  requiresApiKey: boolean;
  termsRiskLevel: "low" | "medium" | "high";
  secretFields: string[];
  configSchema: unknown;
  healthCheck(config: unknown): Promise<AdapterHealth>;
  normalizeSnapshot(input: unknown): Promise<NormalizedAnswerSnapshot>;
}
```

## 5. Normalized Snapshot Shape

```ts
export interface NormalizedAnswerSnapshot {
  promptText: string;
  engine: "CHATGPT" | "GEMINI" | "PERPLEXITY" | "GOOGLE_AI_OVERVIEWS" | "OTHER";
  engineMode: "CONSUMER_MANUAL" | "API_SIMULATION" | "OFFICIAL_API" | "MOCK" | "UNKNOWN";
  captureMethod: "MANUAL_PASTE" | "CSV_IMPORT" | "MOCK_ADAPTER" | "API_ADAPTER";
  answerText: string;
  capturedAt?: string;
  locationContext?: string;
  citationUrls?: string[];
  sourceNames?: string[];
  notes?: string;
}
```

## 6. Manual Snapshot Adapter

Purpose:

- Accept pasted answer text.
- Normalize engine and prompt metadata.
- Extract explicit citation URLs if provided.
- Do not fetch URLs.

Required tests:

- Valid manual snapshot.
- Missing prompt rejected.
- Oversized answer rejected.
- Unsafe HTML escaped.

## 7. CSV Snapshot Adapter

Minimum accepted columns:

```txt
prompt,engine,answer,captured_at,citation_urls,location_context,notes
```

Optional columns:

```txt
client_mentioned,client_cited,competitors_mentioned,accuracy_issues,sentiment
```

Required protections:

- File size limit.
- Row count limit.
- CSV formula injection neutralization.
- Preview before commit.
- Transactional commit.

## 8. Mock Answer-Engine Adapter

Purpose:

- Deterministic local/CI behavior.
- No paid API keys.
- Generates realistic answer snapshots for demos/tests.

Rules:

- Output must be deterministic from prompt/audit seed.
- Include cases where client is missing.
- Include competitor mentions.
- Include citation URLs as inert strings.
- Do not make network calls.

## 9. ChatGPT Manual Adapter

Purpose:

- Represent manually captured ChatGPT observations.
- Do not claim parity with OpenAI API unless separately implemented and labeled.
- No consumer UI automation.

## 10. Gemini Adapter

Purpose:

- Manual Gemini snapshots first.
- Optional Gemini API scaffold behind flags.
- Clearly label API results as API-generated/simulated, not guaranteed consumer Gemini output.

## 11. Perplexity Adapter

Purpose:

- Manual snapshots first.
- Optional API scaffold behind `PERPLEXITY_ENABLED` and `REAL_ANSWER_ENGINE_CALLS_ENABLED`.
- Tests must mock HTTP.
- Normalize citations when API response includes them.

## 12. Google AI Overviews Manual Adapter

Purpose:

- Manual Google AI Overviews snapshots only by default.
- No scraping.
- Store answer text and source URLs manually provided by admin.

## 13. Error Normalization

Every adapter should map provider-specific errors to a consistent shape:

```ts
export interface AdapterError {
  code: string;
  message: string;
  retryable: boolean;
  provider?: string;
  safeDetails?: Record<string, unknown>;
}
```

Never include secrets in error details.

## 14. Health Checks

Manual/mock adapters should report healthy if enabled.

Real adapters should check:

- Feature flag enabled.
- Required secrets configured.
- Timeout policy configured.
- Optional mocked connectivity in test mode.

## 15. Contract Tests

Every adapter must pass:

- Registry metadata exists.
- Config schema exists.
- Secret fields declared.
- Health check works in mock/test mode.
- Normalization returns expected shape.
- Errors normalize safely.
- No real network calls in tests.
