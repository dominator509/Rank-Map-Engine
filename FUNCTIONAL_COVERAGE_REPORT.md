# Functional Coverage Report

## Phase 1: Feature Topology and State Mapping

### BEHAVIORAL_CONTRACT_MAP

#### Workflow: Authentication and Session/API-Key Authorization

- Inputs:
  - `POST /api/auth/register` with `{ email, password, fullName, tenantName }`
  - `POST /api/auth/login` with `{ email, password }`
  - API-key requests with `Authorization: Bearer rm_*`
- Stateful mutations:
  - Creates tenant and user records.
  - Persists session in Postgres session store.
  - Creates/revokes API keys and updates `last_used_at`.
  - Hydrates request auth context (`session.user`) from session or API key.
- Outputs/contracts:
  - Unauthorized requests return `401`.
  - Role-insufficient requests return `403`.
  - API key scope enforcement: read methods require `read`, write methods require `write`.

#### Workflow: Tenant-Scoped CRUD and Data Isolation

- Inputs:
  - Authenticated CRUD calls across clients/projects/keywords/clusters/briefs/reports.
- Stateful mutations:
  - Inserts/updates/deletes in tenant-partitioned tables.
  - Links project entities by foreign keys (`tenant_id`, `project_id`, `client_id`).
- Outputs/contracts:
  - Same-tenant reads/writes succeed.
  - Cross-tenant resource access resolves as `404` or validation failure.

#### Workflow: Integration Credential Lifecycle and Provider Search

- Inputs:
  - `POST /api/integrations` with provider and credential object.
  - `POST /api/integrations/:provider/search` with `{ query }`.
- Stateful mutations:
  - Credentials normalized and stored encrypted in `integration_credentials`.
  - Legacy/plaintext credentials migrated by migration utility.
- Outputs/contracts:
  - Credentials are never echoed in API list response.
  - Decryption failures produce controlled error responses and logs.
  - Provider fetch returns deterministic fallback data when provider is unavailable.

#### Workflow: Scoring and Content-State Pipeline

- Inputs:
  - Keyword metrics (`searchVolume`, `kd`, `cpc`, `intent`, `createdAt`) and score settings.
  - Clustering/brief generation triggers.
- Stateful mutations:
  - Score values written to keyword records.
  - AI task lifecycle transitions (`queued` -> `running` -> terminal states).
  - Cluster/brief/report entities persisted and linked.
- Outputs/contracts:
  - Score output stable and bounded.
  - AI provider failures degrade gracefully to mock behavior.
  - Route aliases preserve expected workflow behavior (`/dashboard`, `/tenants/me`, cluster aliases).

#### External Boundaries and Deterministic Test Strategy

- OpenAI API boundary:
  - Mock via local HTTP server and `OPENAI_BASE_URL`/`OPENAI_API_KEY`.
- SEO provider boundaries (Ahrefs/SEMrush/DataForSEO):
  - Mock `global.fetch` in unit tests; no live network calls.
- Database boundary:
  - Integration/E2E use ephemeral dockerized Postgres from existing harness scripts.
  - Unit tests avoid DB side effects unless explicitly boundary-testing migration/service functions.

#### Concurrency and Throughput Contracts

- API key usage updates (`last_used_at`) must remain consistent under concurrent requests.
- Cluster ownership and keyword linkage must remain tenant-safe under concurrent task execution.
- Stateless route behavior must remain deterministic under parallel request load.

## Phase 2: Unit and Component Verification (Core Logic)

### Added deterministic unit suites

- `artifacts/api-server/src/lib/scoring.test.ts`
- `artifacts/api-server/src/lib/api-key-scopes.test.ts`
- `artifacts/api-server/src/lib/integration-credentials.test.ts`
- `artifacts/api-server/src/lib/keyword-adapters.test.ts`
- `artifacts/api-server/src/lib/ai-provider.test.ts`

### Scope of verification

- Scoring logic:
  - Nullish values, extreme numeric bounds, unknown intents, freshness decay behavior.
- API key scopes:
  - Scope normalization, malformed scope rejection, read/write permission boundaries.
- Integration credential crypto:
  - Envelope detection, normalize/reject malformed values, encrypt/decrypt round trips, legacy plaintext compatibility.
- Provider adapters:
  - Deterministic fallback behavior when env creds are missing or provider calls fail.
  - Parsing behavior for provider payload formats.
- AI provider orchestration:
  - Provider selection by env, JSON parse/filter behavior, fallback-to-mock guarantees.

### Execution status

- Command:
  - `pnpm exec vitest run artifacts/api-server/src/lib/scoring.test.ts artifacts/api-server/src/lib/integration-credentials.test.ts artifacts/api-server/src/lib/keyword-adapters.test.ts artifacts/api-server/src/lib/ai-provider.test.ts artifacts/api-server/src/lib/api-key-scopes.test.ts --coverage --coverage.all=false`
- Result:
  - 5 test files passed, 20 tests passed.

### Coverage snapshot (Phase 2 run)

- `scoring.ts`: 100% statements, 91.66% branches.
- `api-key-scopes.ts`: 93.54% statements, 68.75% branches.
- `integration-credentials.ts`: 93.9% statements, 86.66% branches.
- `keyword-adapters.ts`: 80.43% statements, 48.64% branches.
- `ai-provider.ts`: 94.28% statements, 72.72% branches.

### Tooling note

- Running coverage with default `all=true` currently fails due a `vitest`/`minimatch` runtime issue (`brace_expansion is not a function`). The deterministic workaround for CI is `--coverage.all=false`.

## Phase 3: Integration and Boundary Validation

### Added suite

- `artifacts/api-server/src/routes/api.boundary.e2e.test.ts`

### Boundary and handoff checks implemented

- Payload schema mismatch handling:
  - Rejects integration payloads with non-string credential fields.
  - Rejects missing search query payloads.
- API boundary validation:
  - Rejects unsupported provider search routes.
  - Verifies degraded fallback behavior when upstream provider fetch fails.
- Module intersection behavior:
  - Route -> auth/session -> DB insert/query -> adapter invocation chain verified in one deterministic flow.

### Deterministic fixtures/factories used

- Runtime-generated tenant/user fixture via `/api/auth/register`.
- Deterministic integration payloads for provider and malformed variants.
- Controlled upstream failure injection by URL-aware `fetch` stub:
  - Allows in-process app HTTP requests.
  - Rejects outbound third-party URL calls.

### Execution status

- Command:
  - `pnpm exec vitest run artifacts/api-server/src/routes/api.boundary.e2e.test.ts` (with `RUN_API_E2E=1`, ephemeral Postgres, migrated schema).
- Result:
  - 1/1 integration boundary test passed.

### Observed failure mode during orchestration (non-app code)

- Running `api.e2e.test.ts` and `api.boundary.e2e.test.ts` in the same Vitest invocation produced a setup race around `ensureSessionTable()` in test bootstrap (`duplicate key value violates unique constraint "pg_type_typname_nsp_index"`).
- This is a test-harness concurrency issue in startup orchestration, not an application runtime contract failure.

## Phase 4: High-Concurrency and End-to-End Workflow Validation

### Added suite

- `artifacts/api-server/src/routes/api.concurrency.e2e.test.ts`

### High-throughput checks implemented

- Parallel authenticated read load:
  - 25 concurrent `GET /api/tenant/dashboard` requests via API key.
  - Asserts all responses are `200`.
  - Verifies API-key `last_used_at` persisted.
- Parallel write load:
  - 15 concurrent `POST /api/projects` requests under one tenant/client.
  - Asserts all responses are `201`.
  - Verifies final persisted project count matches request count exactly.

### End-state verification against BEHAVIORAL_CONTRACT_MAP

- Confirms tenant-scoped integrity under concurrency.
- Confirms auth state mutation (`last_used_at`) under read throughput.
- Confirms deterministic final DB cardinality after concurrent writes.

### Execution status

- Command:
  - `pnpm exec vitest run artifacts/api-server/src/routes/api.concurrency.e2e.test.ts` (with `RUN_API_E2E=1`, ephemeral Postgres, migrated schema).
- Result:
  - 1/1 concurrency E2E test passed.

## Phase 5: Final Verification and Repository-Wide Results

### End-to-end verification commands executed

- `pnpm run typecheck` -> passed.
- `pnpm run lint` -> passed.
- `pnpm run test` -> passed.
- `pnpm run test:e2e:api` -> passed.
- `pnpm exec vitest run artifacts/api-server/src/routes/api.boundary.e2e.test.ts` (with ephemeral Postgres + `RUN_API_E2E=1`) -> passed.
- `pnpm exec vitest run artifacts/api-server/src/routes/api.concurrency.e2e.test.ts` (with ephemeral Postgres + `RUN_API_E2E=1`) -> passed.
- Phase-2 targeted coverage run with deterministic workaround:
  - `pnpm exec vitest run ... --coverage --coverage.all=false` -> passed.

### Existing failure points detected by rigorous constraints

- No functional application-code regression failures were detected in executed suites.
- One reproducible test-orchestration issue was detected when combining multiple E2E files in a single Vitest invocation:
  - `ensureSessionTable()` setup race can trigger a Postgres duplicate type/index creation error.
  - Classification: test harness/bootstrap concurrency issue, not business-logic failure.

### Missing coverage and recommended next additions

- Remaining branch gaps are concentrated in:
  - `keyword-adapters.ts` alternate provider error and parsing branches.
  - `ai-provider.ts` additional malformed payload and timeout permutations.
  - `api-key-scopes.ts` non-critical normalization branch permutations.
- Additional repository modules still needing dedicated suites for full-stack confidence:
  - `billing.ts` webhook edge permutations under concurrency.
  - `gdpr.ts` privacy-export/deletion negative-path validation.
  - `webhook-emitter.ts` retry/backoff and downstream-failure behavior.
