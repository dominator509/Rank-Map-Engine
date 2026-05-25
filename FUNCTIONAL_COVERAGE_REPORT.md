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

