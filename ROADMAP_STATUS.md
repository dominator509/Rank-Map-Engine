# RankMap — Roadmap Status

> Live tracking of phase completion. Updated after every phase.

---

## Current Phase: Phase 39 - Launch Readiness and Operational Handoff

**Status:** The false generated "all 39 phases complete" claim has been retired. Phases 11-39 now follow the canonical roadmap in `BUILD_ROADMAP.md`; implementation status must be proven phase by phase.

**Last audited:** 2026-05-22

**Current production-readiness focus:** collect hosted staging load-test evidence, real-provider smoke-test evidence, operational handoff approvals, and final go/no-go sign-off.

The summary below is the working truth table. The detailed generated checklist sections later in this file are retained as historical implementation notes only; do not treat their "complete" headings as launch sign-off until they are reconciled against the canonical acceptance criteria.

---

## Canonical Phase Summary

| Phase | Canonical Name | Truthful Status | Next Evidence Needed |
|-------|----------------|-----------------|----------------------|
| 0 | Repository Initialization | Implemented; evidence needs reconciliation | Confirm setup works from clean checkout |
| 1 | Auth, RBAC, Tenant Isolation | Implemented; needs canonical re-verification | Auth and cross-tenant route tests |
| 2 | Client and Project Management | Implemented; needs canonical re-verification | CRUD browser and API journey evidence |
| 3 | Keyword Import Engine | Implemented; needs canonical re-verification | Import validation and edge-case tests |
| 4 | Keyword Scoring Engine | Implemented; needs canonical re-verification | Deterministic scoring tests |
| 5 | AI Clustering | Implemented with mock/manual paths; live AI unverified | AI provider fixture and fallback tests |
| 6 | Topic Maps and Content Roadmaps | Implemented; needs canonical re-verification | End-to-end topic map journey |
| 7 | Content Briefs | Implemented with mock/manual paths; live AI unverified | Brief generation and manual fallback evidence |
| 8 | Reporting and Exports | Implemented; needs canonical re-verification | Export correctness and authorization tests |
| 9 | Client Dashboard and White Labeling | Implemented; needs canonical re-verification | Browser coverage for dashboard states |
| 10 | Stripe Licensing and Billing | Implemented with real checkout/portal/webhook paths; live credentials pending | Live Stripe smoke test in staging |
| 11 | Ahrefs Keyword Adapter | Canonical phase defined; not verified complete | Provider adapter, fixtures, and live-provider notes |
| 12 | Semrush Keyword Adapter | Canonical phase defined; not verified complete | Provider adapter, fixtures, and live-provider notes |
| 13 | DataForSEO Keyword Adapter | Canonical phase defined; not verified complete | Provider adapter, task polling tests |
| 14 | Real AI Providers | Canonical phase defined; partially supported by mock/manual flows | Real provider adapter verification |
| 15 | Audit Log System | Canonical phase defined; not verified complete | Append-only audit model and route coverage |
| 16 | Team Management | Canonical phase defined; not verified complete | Invite, role, and tenant-isolation tests |
| 17 | API Key System | Canonical phase defined; not verified complete | Hashed keys, scopes, and public API tests |
| 18 | Webhook System | Canonical phase defined; inbound Stripe exists; outbound customer webhooks unverified | Outbound delivery, signing, replay tests |
| 19 | In-App Notification System | Canonical phase defined; not verified complete | Notification model and UI journey |
| 20 | Content Calendar | Canonical phase defined; not verified complete | Calendar model, UI, and status transitions |
| 21 | Comments and Collaboration | Canonical phase defined; not verified complete | Comments, mentions, and permissions tests |
| 22 | Competitor Analysis and Keyword Gap | Canonical phase defined; not verified complete | Competitor model and gap scoring evidence |
| 23 | Rank Tracking | Canonical phase defined; not verified complete | Snapshot storage and scheduled collection tests |
| 24 | Email Notification System | Canonical phase defined; not verified complete | Mock and real email provider evidence |
| 25 | Advanced Analytics Dashboard | Canonical phase defined; not verified complete | Metric definitions and aggregation tests |
| 26 | Bulk Keyword Export | Canonical phase defined; not verified complete | Bulk job, filters, and authorization tests |
| 27 | Project Templates | Canonical phase defined; not verified complete | Template application and permission tests |
| 28 | Custom Fields | Canonical phase defined; not verified complete | Field definitions, validation, and export support |
| 29 | Full Project Data Export | Canonical phase defined; not verified complete | Full export package and tenant safety tests |
| 30 | Scheduled Reports | Canonical phase defined; not verified complete | Scheduler, delivery, and report history tests |
| 31 | Usage Analytics and Plan Metering | Canonical phase defined; not verified complete | Usage counters and plan-limit enforcement |
| 32 | GDPR Compliance Tools | Canonical phase defined; not verified complete | Data export, deletion/anonymization, retention evidence |
| 33 | Enhanced Health and Monitoring | Partially implemented through health/config checks | Dependency readiness and degraded-state coverage |
| 34 | Security Hardening | Canonical phase defined; not verified complete | Threat model, rate limits, and security scan evidence |
| 35 | Observability and Incident Readiness | Canonical phase defined; not verified complete | Runbooks, metrics, tracing/logging evidence |
| 36 | Database Migrations and Release Gate | Implemented and locally verified; live production config pending | CI/preflight evidence plus staging credentials |
| 37 | Browser E2E and Frontend Production QA | Substantially complete; browser E2E, mobile, accessibility, and visual baselines passing | Broaden browser coverage opportunistically as new features stabilize |
| 38 | Performance, Scalability, and Reliability | Local Phase 38 baseline complete; hosted staging/load evidence still pending for launch | Carry hosted staging load and real-provider smoke evidence into Phase 39 sign-off |
| 39 | Launch Readiness and Operational Handoff | In progress; launch record created, current decision no-go pending external evidence | Attach hosted staging load tests, real-provider smoke tests, backup/PITR confirmation, monitoring/alerting confirmation, rollback rehearsal, and owner approvals |

---

## Phase 37 Evidence - 2026-05-10

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm run test:e2e:browser` | Pass | Starts disposable Postgres, applies migrations, starts API and frontend, then verifies register, login, dashboard, client creation, project creation, project detail navigation, manual keyword creation, pasted keyword import, manual brief creation, brief approval, workspace profile update, white-label settings update, billing disabled-state behavior, current plan display, team member display, solo-plan invite limit handling, mobile navigation at 390px width, and axe accessibility checks for registration plus authenticated critical screens: dashboard, clients, project detail, settings, billing, and team. |
| Phase 37 accessibility remediation | Pass | Fixed auth/invite page landmarks, mobile layout navigation, empty-client heading order, project detail tab semantics, project back-link name, billing progress labels, and team member action button label. |
| Phase 37 visual snapshots | Pass | Added Playwright screenshot baselines for registration, empty dashboard, empty clients, solo billing, and mobile primary navigation. Snapshot update mode is available through `UPDATE_PLAYWRIGHT_SNAPSHOTS=1 pnpm run test:e2e:browser`; normal browser E2E verifies against committed baselines. |
| `pnpm run typecheck` | Pass | Full workspace typecheck completed after browser E2E changes. |
| `pnpm run format:check` | Pass | Generated Playwright output folders are ignored so local artifacts do not break formatting checks. |
| `pnpm run lint` | Pass | ESLint completed with zero warnings. |

---

## Phase 38 Evidence - 2026-05-20

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm run perf:baseline` | Pass | Starts disposable Postgres, applies migrations, builds and starts API, seeds tenant/client/project plus 100 keywords, seeds a 500-task AI backlog, verifies sequential API, report/export, queue backlog, concurrent read/export/backlog p95 budgets, and checks billing-misconfig plus database-outage degraded health behavior. |
| Keyword import seed | Pass | 100 keywords imported in 68ms against the disposable baseline database. |
| AI task backlog seed | Pass | 500 tasks inserted and verified in 364ms: 350 queued, 100 running, and 50 completed. |
| Core API p95 baseline | Pass | healthz 9ms, auth.me 18ms, tenant.dashboard 65ms, clients.list 30ms, projects.list 17ms, project.detail 10ms, keywords.list 16ms, briefs.list 11ms. |
| Queue backlog p95 baseline | Pass | ai.tasks.backlog 33ms for 500 tasks and ai.task.detail 8ms for a queued task. |
| Report/export p95 baseline | Pass | report.generate 84ms, export.keywords.csv 12ms, export.project.json 20ms, with generated reports and seeded export data validated. |
| Concurrent read/export/backlog baseline | Pass | healthz.concurrent p95 21ms, dashboard.concurrent p95 48ms, keywords.concurrent p95 54ms, export.project.concurrent p95 43ms, ai.tasks.concurrent p95 77ms, all with 0 failures. |
| Degraded billing health baseline | Pass | With billing enabled and Stripe config absent, detailed health returned 503 in 10ms with database ok and billing `missing-config`. |
| Database outage health baseline | Pass | After the disposable database was stopped, detailed health returned 503 in 10ms with database `error` instead of resetting the request. |
| Database pool resilience | Fixed | Added a shared PostgreSQL pool error handler so idle client errors are logged and do not terminate the API process during database interruption. |
| `pnpm run perf:pages` | Pass | Starts disposable Postgres, applies migrations, builds the API, builds the production frontend bundle, serves it through a same-origin local harness, seeds an authenticated workspace, and measures key screens in Chromium. |
| Production page-load baseline | Pass | login 1076ms, dashboard 698ms, clients 631ms, client.detail 646ms, project.detail 681ms with 100 keywords, analytics 671ms, billing 661ms, settings 734ms, mobile.dashboard 618ms, and 0 browser runtime errors. |
| `pnpm run recovery:baseline` | Pass | Starts disposable source and restore PostgreSQL databases, applies migrations to source, seeds representative tenant/project data, creates a custom-format dump, restores into a clean database, and verifies source/restored counts plus checksums. |
| Backup/restore baseline | Pass | Dump completed in 803ms, restore completed in 2876ms, and restored tenants=1, users=2, clients=1, projects=1, keywords=120, aiTasks=60, reports=2 with matching source/restored fingerprints. |
| `pnpm run perf:tenant-size` | Pass | Starts disposable Postgres, applies migrations, builds and starts API, seeds a larger tenant, and measures dashboard, list, export, and backlog endpoints against the larger dataset. |
| Larger tenant-size baseline | Pass | Seeded 25 clients, 100 projects, 9950 keywords, 1000 AI tasks, and 20 reports in 3368ms; p95s were dashboard 225ms, clients 81ms, projects 62ms, keywords 507ms for 5000 target-project keywords, keyword CSV export 251ms, project JSON export 378ms, and AI tasks 104ms. |
| AI provider timeout configurability | Fixed | OpenAI-compatible provider calls now honor `OPENAI_TIMEOUT_MS` and `OPENAI_BASE_URL`, allowing production tuning and deterministic local failure-mode tests. |
| `pnpm run perf:slow-provider` | Pass | Starts disposable Postgres, applies migrations, builds and starts API, runs a deliberately delayed local OpenAI-compatible endpoint, triggers auto-clustering, and verifies fast mock fallback. |
| Slow-provider fallback baseline | Pass | The fake OpenAI-compatible endpoint delayed for 1500ms, API timeout was configured to 200ms, and auto-clustering fell back to mock in 257ms while creating 1 cluster and recording attempted provider `openai`. |
| `docs/BACKUP_RESTORE.md` | Added | Documents local recovery proof plus production backup requirements for managed backups, point-in-time recovery, restore drills, access control, and sensitive restored data handling. |
| `docs/PERFORMANCE_BASELINE.md` | Added | Documents sequential budgets, report/export budgets, queue backlog budgets, tenant-size budgets, slow-provider budgets, concurrent budgets, degraded billing and database-outage coverage, production page-load budgets, recovery baseline, latest local numbers, and remaining Phase 38 limitations. |

---

## Phase 39 Evidence - 2026-05-22

| Check | Result | Notes |
|-------|--------|-------|
| `docs/LAUNCH_READINESS.md` | Added | Canonical Phase 39 sign-off record created with current no-go decision, required hosted staging load-test evidence, real-provider smoke-test evidence, production handoff checklist, and known blockers. |
| Hosted staging load-test evidence | Pending | Required before launch. Must use a hosted production-like staging deployment and record staging URL, dataset size, runner/tool, concurrency, duration, p95 latency, error rate, operator, and result. |
| `pnpm run staging:smoke-load` | Added | Hosted staging smoke/load runner accepts `STAGING_BASE_URL`, seeds or reuses a staging test account, exercises critical browser/API paths, runs concurrent API checks, and writes Markdown/JSON launch evidence under `artifacts/staging-launch/`. |
| Real-provider smoke-test evidence | Pending | Required before launch. Run `pnpm run test:live:services` with live/staging credentials; set `LIVE_KEYWORD_PROVIDER_CHECKS=true` when keyword-provider quota spend is approved. |
| Local credential availability check | Complete | `LIVE_SERVICES_OPTIONAL=1 LIVE_KEYWORD_PROVIDER_CHECKS=true pnpm run test:live:services` ran on 2026-05-22; all 7 live checks skipped because OpenAI, Stripe, SMTP, Ahrefs, Semrush, and DataForSEO credentials are not present in this local environment. |
| Production backup/PITR confirmation | Pending | Local logical backup/restore proof exists, but managed hosted backup policy, retention, and point-in-time recovery must be confirmed before launch. |
| Monitoring/alerting confirmation | Pending | API, database, jobs/queue, providers, billing/webhooks, latency, and error-rate monitoring must be live before launch. |
| Rollback rehearsal | Pending | Required in staging before final go decision. |
| `docs/RELEASE.md` | Updated | Release gate now links to Phase 39 launch readiness and states local preflight alone is not launch approval. |
| `docs/ENV.md` | Updated | Documents `OPENAI_BASE_URL` and `OPENAI_TIMEOUT_MS` for provider timeout/fallback configuration. |
| Current go/no-go | No-go | Launch blocked until the pending external evidence and owner approvals are attached. |

---

## Phase 0 Checklist — ALL COMPLETE

### Infrastructure
- [x] `artifacts/rankmap` — React + Vite frontend scaffolded
- [x] `artifacts/api-server` — Express 5 API server scaffolded
- [x] `lib/db` — Drizzle ORM + PostgreSQL setup
- [x] `lib/api-spec` — OpenAPI spec (health endpoint)
- [x] `lib/api-client-react` — Generated React Query hooks (codegen complete)
- [x] `lib/api-zod` — Generated Zod schemas (codegen complete)

### Documentation
- [x] `ARCHITECTURE.md` — Canonical architecture document
- [x] `BUILD_ROADMAP.md` — Canonical build roadmap (Phases 0–39)
- [x] `ROADMAP_STATUS.md` — This file
- [x] `README.md` — Project overview and setup guide
- [x] `docs/SECURITY.md` — Security policy
- [x] `docs/ENV.md` — Environment variable reference

### Tooling
- [x] `.env.example` — Fake placeholders only, no real secrets
- [x] `vitest.config.ts` — Vitest configuration
- [x] `eslint.config.js` — ESLint with no-hardcoded-secrets rules
- [x] `.prettierrc` + `.prettierignore` — Prettier configuration

---

## Phase 1 Checklist — Auth, RBAC, Tenant Isolation — COMPLETE

- [x] `POST /api/auth/register` — Creates user + tenant, hashes password (bcrypt), sets session
- [x] `POST /api/auth/login` — Authenticates, creates session cookie
- [x] `POST /api/auth/logout` — Destroys session
- [x] `GET /api/auth/me` — Returns authenticated user
- [x] `requireAuth` middleware — 401 if no session
- [x] `requireRole(roles[])` middleware — 403 if wrong role
- [x] `express-session` + `connect-pg-simple` — PostgreSQL session store
- [x] Session table auto-created at startup via `ensureSessionTable()`
- [x] `GET /api/tenant/me` — Returns current tenant
- [x] `PUT /api/tenant/me` — Updates tenant name / white-label config
- [x] `GET /api/tenant/dashboard` — Workspace metrics (clientCount, projectCount, keywordCount, etc.)

---

## Phase 2 Checklist — Client & Project Management — COMPLETE

- [x] `GET /api/clients` — List all clients (tenant-scoped)
- [x] `POST /api/clients` — Create client
- [x] `GET /api/clients/:id` — Get client by ID
- [x] `PUT /api/clients/:id` — Update client
- [x] `DELETE /api/clients/:id` — Soft delete / hard delete client
- [x] `GET /api/clients/:clientId/projects` — List projects for client
- [x] `POST /api/clients/:clientId/projects` — Create project
- [x] `GET /api/projects/:id` — Get project
- [x] `PUT /api/projects/:id` — Update project
- [x] `DELETE /api/projects/:id` — Delete project

---

## Phase 3 Checklist — Keyword Import Engine — COMPLETE

- [x] `GET /api/projects/:projectId/keywords` — List keywords with scoring
- [x] `POST /api/projects/:projectId/keywords` — Create single keyword
- [x] `POST /api/projects/:projectId/keywords/import` — Bulk CSV import with deduplication
- [x] `GET /api/projects/:projectId/keywords/:id` — Get keyword
- [x] `PUT /api/projects/:projectId/keywords/:id` — Update keyword
- [x] `DELETE /api/projects/:projectId/keywords/:id` — Delete keyword
- [x] `GET /api/projects/:projectId/score-settings` — Get project score weights
- [x] `PUT /api/projects/:projectId/score-settings` — Update score weights

---

## Phase 4 Checklist — Keyword Scoring Engine — COMPLETE

- [x] `src/lib/scoring.ts` — `computeScore()` with configurable weights
- [x] Weights: volume, KD, intent, CPC, freshness (sum to 1)
- [x] Score persisted to `finalScore` on keyword create/update/import
- [x] Score re-computed on score-settings update (all project keywords re-scored)
- [x] Intent bonus: +0.1 for transactional/commercial keywords

---

## Phase 5 Checklist — AI Clustering (Mock) — COMPLETE

- [x] `GET /api/projects/:projectId/clusters` — List clusters
- [x] `POST /api/projects/:projectId/clusters` — Create manual cluster
- [x] `POST /api/projects/:projectId/clusters/auto` — AI clustering (mock)
- [x] `GET /api/projects/:projectId/clusters/:id` — Get cluster
- [x] `PUT /api/projects/:projectId/clusters/:id` — Update cluster
- [x] `DELETE /api/projects/:projectId/clusters/:id` — Delete cluster
- [x] `POST /api/projects/:projectId/clusters/:id/approve` — Approve cluster
- [x] `POST /api/projects/:projectId/clusters/:id/reject` — Reject cluster
- [x] `src/lib/ai.ts` — `enqueueAiTask()` records tasks in `ai_tasks` table
- [x] Mock clustering assigns keywords to clusters without an API key

---

## Phase 6 Checklist — Topic Maps & Content Roadmaps — COMPLETE

- [x] `GET /api/projects/:projectId/topic-map` — Pillar + cluster hierarchy
- [x] `GET /api/projects/:projectId/roadmap` — Clusters ranked by avg keyword score
- [x] Topic map computes authority score from cluster coverage
- [x] Roadmap supports CSV export via `?format=csv`

---

## Phase 7 Checklist — Content Briefs — COMPLETE

- [x] `GET /api/projects/:projectId/briefs` — List briefs
- [x] `POST /api/projects/:projectId/briefs` — Create manual brief
- [x] `POST /api/projects/:projectId/briefs/:id/generate` — AI brief generation (mock)
- [x] `GET /api/projects/:projectId/briefs/:id` — Get brief
- [x] `PUT /api/projects/:projectId/briefs/:id` — Update brief
- [x] `DELETE /api/projects/:projectId/briefs/:id` — Delete brief
- [x] `POST /api/projects/:projectId/briefs/:id/approve` — Approve brief
- [x] Mock AI generates structured JSON outline (sections, target keywords, word count)

---

## Phase 8 Checklist — Reporting & Exports — COMPLETE

- [x] `GET /api/projects/:projectId/reports` — List reports
- [x] `POST /api/projects/:projectId/reports/generate` — Generate report
- [x] `GET /api/projects/:projectId/reports/:id` — Get report
- [x] `DELETE /api/projects/:projectId/reports/:id` — Delete report
- [x] Report types: `project_summary`, `topical_authority`, `content_pipeline`
- [x] Formats: `pdf`, `csv`, `json`

---

## Phase 9 Checklist — Client Dashboard & White-Label — COMPLETE

- [x] White-label config stored in `tenants.whiteLabelConfig` (JSONB)
- [x] `GET /api/tenant/me` exposes `whiteLabelConfig`
- [x] `PUT /api/tenant/me` updates white-label config (agency_admin only)
- [x] Client-role restricted dashboard view via RBAC middleware
- [x] `GET /api/tenant/dashboard` — Role-aware workspace metrics

---

## Phase 10 Checklist — Stripe Billing (Feature-Flagged) — COMPLETE

- [x] `GET /api/billing/subscription` — Current subscription
- [x] `GET /api/billing/plans` — Available plans
- [x] `GET /api/billing/usage` — Seat + AI task usage
- [x] `POST /api/billing/checkout` — Create Stripe checkout session (feature-flagged)
- [x] `POST /api/billing/portal` — Create Stripe billing portal (feature-flagged)
- [x] `POST /api/billing/webhook` — Stripe webhook handler (feature-flagged)
- [x] `FEATURE_STRIPE=true` env var gates all Stripe calls
- [x] Plan enforcement middleware ready for Phase 11+

---

## Phases 11–13 Checklist — Keyword Adapters — COMPLETE

- [x] `artifacts/api-server/src/lib/keyword-adapters.ts` — Unified adapter interface
- [x] Ahrefs adapter — `fetchFromAhrefs()` using Keywords Explorer v3 API
- [x] SEMrush adapter — `fetchFromSEMrush()` using Phrase Related API
- [x] DataForSEO adapter — `fetchFromDataForSEO()` using Keywords Data API
- [x] Mock fallback for all adapters when API keys not set
- [x] `POST /api/integrations/:provider/search` — Keyword search via any adapter
- [x] `GET /api/integrations` — List connected integrations
- [x] `POST /api/integrations` — Save integration credentials (upsert)
- [x] `DELETE /api/integrations/:provider` — Remove integration
- [x] Credentials stored in `integration_credentials` table (JSONB, tenant-scoped)

---

## Phase 14 Checklist — Real AI Providers — COMPLETE

- [x] `artifacts/api-server/src/lib/ai-provider.ts` — OpenAI + mock provider
- [x] `clusterKeywordsWithAI()` — GPT-4o-mini clustering with JSON response_format
- [x] `generateBriefWithAI()` — GPT-4o-mini content brief generation
- [x] Automatic fallback to mock when `OPENAI_API_KEY` not set
- [x] `POST /api/projects/:id/clusters/auto` — Uses real AI clustering
- [x] `POST /api/projects/:id/briefs/:id/generate` — Uses real AI brief generation
- [x] Brief generation pulls cluster keywords for context
- [x] Webhook event emitted on cluster.created
- [x] Audit event recorded on auto-clustering

---

## Phase 15 Checklist — Audit Log — COMPLETE

- [x] `lib/db/src/schema/audit-log.ts` — `audit_log` table (tenant-scoped, user-linked)
- [x] `artifacts/api-server/src/lib/audit.ts` — `audit()` helper (never throws)
- [x] `GET /api/audit-log` — Paginated audit log (admin only, limit/offset/resourceType/action filters)
- [x] Audit events recorded for: api_key.created/revoked, webhook.created/deleted, integration.configured/removed, cluster.auto_clustered, team.invite_sent, team.member_removed, team.role_changed
- [x] IP address + user agent captured from request
- [x] Left join with users table for userName/userEmail in response
- [x] Frontend `/audit-log` page — paginated table with resource type filter

---

## Phase 16 Checklist — Team Management — COMPLETE

- [x] `lib/db/src/schema/invitations.ts` — `user_invitations` table with token + 7-day expiry
- [x] `GET /api/team` — List team members (tenant-scoped)
- [x] `POST /api/team/invite` — Send invitation (enforces seat limit, generates unique token)
- [x] `GET /api/team/invitations` — List pending invitations
- [x] `DELETE /api/team/invitations/:id` — Cancel invitation
- [x] `POST /api/team/invitations/accept` — Accept invite (creates user + sets session)
- [x] `PATCH /api/team/:userId` — Change member role
- [x] `DELETE /api/team/:userId` — Remove member (cannot remove self)
- [x] Seat limit enforcement: `seatsUsed >= seatsMax` returns 402
- [x] Frontend `/team` page — members list, role badges, invite dialog with shareable link
- [x] Frontend `/accept-invite` page — token-based invite acceptance with account setup
- [x] Sidebar "Workspace" section with Team link

---

## Phase 17 Checklist — API Key System — COMPLETE

- [x] `lib/db/src/schema/api-keys.ts` — `api_keys` table (bcrypt hash, prefix, scopes, expiry, revoked_at)
- [x] `GET /api/api-keys` — List active keys (no hash exposed, shows keyPrefix only)
- [x] `POST /api/api-keys` — Create key (returns raw key once, stores bcrypt hash)
- [x] `DELETE /api/api-keys/:id` — Revoke key (sets revoked_at)
- [x] Key format: `rm_` prefix + 64 hex chars (random bytes)
- [x] `keyPrefix` = first 10 chars shown in UI for identification
- [x] Optional expiry via `expiresInDays` parameter
- [x] Frontend `/api-keys` page — key list, create dialog with one-time reveal, revoke action
- [x] Sidebar "API Keys" link under Workspace section

---

## Phase 18 Checklist — Webhook System — COMPLETE

- [x] `lib/db/src/schema/webhooks.ts` — `webhook_endpoints` + `webhook_deliveries` tables
- [x] `artifacts/api-server/src/lib/webhook-emitter.ts` — HMAC-SHA256 signed dispatch
- [x] `GET /api/webhooks` — List endpoints (secret redacted)
- [x] `POST /api/webhooks` — Create endpoint (auto-generates secret)
- [x] `PATCH /api/webhooks/:id` — Update URL/events/active status
- [x] `DELETE /api/webhooks/:id` — Delete endpoint
- [x] `POST /api/webhooks/:id/test` — Send test event (project.created)
- [x] `GET /api/webhooks/:id/deliveries` — Delivery history with status codes
- [x] `GET /api/webhooks/events` — List all supported event types (9 events)
- [x] HMAC-SHA256 signature in `X-RankMap-Signature` header
- [x] 10-second fetch timeout with per-delivery status tracking
- [x] Frontend `/webhooks` page — endpoint list, create dialog with event selector, delivery log

---

## Security Hardening — COMPLETE

- [x] `helmet` middleware — secure HTTP headers (COOP, X-Frame, X-Content-Type, etc.)
- [x] `express-rate-limit` — 500 req/15min global, 20 req/15min on auth routes
- [x] Body size limit: 2mb (prevents payload attacks)
- [x] `trust proxy: 1` for accurate IP logging behind reverse proxy
- [x] Health endpoint (`/api/healthz`) excluded from rate limiting

---

## Frontend Checklist — Phases 1–18 UI — COMPLETE

- [x] `/login` — Sign in page with email + password
- [x] `/register` — Create account (email, password, fullName, tenantName)
- [x] `/dashboard` — Workspace metrics: clients, projects, keywords, clusters, briefs, AI tasks
- [x] `/clients` — Searchable client list with create/edit/delete
- [x] `/clients/:clientId` — Client detail + projects list with create/delete
- [x] `/clients/:clientId/projects/:projectId/:tab?` — Project detail with tab nav
- [x] `/ai-tasks` — AI task queue with live polling (5s), status badges
- [x] `/billing` — Subscription plan + usage metrics
- [x] `/settings` — Tenant name + white-label config
- [x] `/team` — Members list with role badges, invite dialog, pending invitations panel
- [x] `/audit-log` — Paginated activity log with resource type filter
- [x] `/api-keys` — Key list, create dialog (one-time key reveal), revoke button
- [x] `/webhooks` — Endpoint list, create dialog with event selector, delivery log expandable
- [x] `/integrations` — Provider cards (Ahrefs, SEMrush, DataForSEO, GSC) with configure dialogs
- [x] `/accept-invite` — Token-based invite acceptance + account creation
- [x] `useAuth()` hook — wraps `useGetCurrentUser`, returns `{user, isLoading, isAuthenticated}`
- [x] `ProtectedRoute` — Redirects to `/login` if not authenticated
- [x] Sidebar — Platform section (Dashboard, Clients, AI Tasks) + Workspace section (Team, Integrations, Webhooks, API Keys, Audit Log)

---

## Test Results — Phases 11–18 (Smoke Test)

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm run typecheck` (full) | ✅ Pass | 0 errors across all 4 packages |
| `GET /api/team` | ✅ Pass | Returns tenant-scoped member list |
| `POST /api/team/invite` | ✅ Pass | Seat limit enforced (402 when at limit) |
| `GET /api/audit-log` | ✅ Pass | Paginated events with userName/email joined |
| `POST /api/api-keys` | ✅ Pass | `rm_` prefixed key returned once (bcrypt stored) |
| `GET /api/api-keys` | ✅ Pass | keyPrefix shown, keyHash never exposed |
| `POST /api/webhooks` | ✅ Pass | Endpoint created with HMAC secret |
| `GET /api/webhooks/events` | ✅ Pass | 9 supported event types |
| `POST /api/integrations` | ✅ Pass | Credentials stored (upsert) |
| `POST /api/integrations/:id/search` | ✅ Pass | Mock fallback returns 5 keyword records |
| Audit events recorded | ✅ Pass | api_key.created, webhook.created, integration.configured all logged |
| Security headers (helmet) | ✅ Pass | X-Frame-Options, X-Content-Type-Options, etc. |
| Rate limiter active | ✅ Pass | 500 req/15min global; 20/15min on auth |
| DB tables created | ✅ Pass | audit_log, user_invitations, api_keys, webhook_endpoints, webhook_deliveries, integration_credentials |

---

## Test Results — Phases 1–10 (Full E2E Smoke Test)

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm run typecheck` | ✅ Pass | 0 errors across all 4 artifacts |
| `GET /api/healthz` | ✅ Pass | `{"status":"ok"}` |
| `POST /api/auth/login` | ✅ Pass | Session cookie set |
| `GET /api/tenant/dashboard` | ✅ Pass | All 7 DashboardSummary fields returned |
| `GET /api/clients` | ✅ Pass | Tenant-scoped list |
| `POST /api/projects` | ✅ Pass | clientId in body, tenant-scoped |
| `GET /api/projects?clientId=x` | ✅ Pass | Filtered by client |
| `POST /api/projects/:id/keywords/import` | ✅ Pass | 5 imported, 0 duplicates |
| `POST /api/projects/:id/clusters/auto` | ✅ Pass | 5 clusters created, AI task queued |
| `POST /api/projects/:id/clusters/:id/approve` | ✅ Pass | Status → approved |
| `GET /api/projects/:id/topic-map` | ✅ Pass | Pillar/cluster hierarchy |
| `GET /api/projects/:id/roadmap` | ✅ Pass | Priority-ranked clusters |
| `POST /api/projects/:id/briefs` | ✅ Pass | Brief created |
| `POST /api/projects/:id/briefs/:id/generate` | ✅ Pass | Mock AI outline generated |
| `POST /api/projects/:id/reports` | ✅ Pass | Report generated with summary data |
| `GET /api/billing/plans` | ✅ Pass | solo/agency/enterprise plans |
| `GET /api/billing/usage` | ✅ Pass | aiTasksThisMonth, limits, projectsCount |
| `GET /api/ai-tasks` | ✅ Pass | Task queue with status |
| Frontend loads at `/` | ✅ Pass | Redirects to `/login` when unauthenticated |

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Session store | `connect-pg-simple` | Reuses existing Postgres, no Redis dependency |
| Session table | Created at startup via raw SQL | `createTableIfMissing` incompatible with esbuild bundle |
| AI provider | Mock by default | No API key required; provider field allows future swap |
| Stripe | Feature-flagged (`FEATURE_STRIPE`) | Safely ships without keys configured |
| Scoring | In-process `computeScore()` | No queue overhead for MVP; weights stored per-project |
| Clustering | Enqueues `aiTasksTable` record | Async-ready pattern, mock runs synchronously |

---

## Change Log

| Date | Phase | Change |
|------|-------|--------|
| 2026-05-03 | Phases 1–10 | All backend routes complete (auth, clients, projects, keywords, clusters, topic-map, briefs, reports, billing) |
| 2026-05-03 | Phases 1–10 | Full frontend built (auth pages, dashboard, clients, projects, AI tasks, billing, settings) |
| 2026-05-03 | Phase 1 | Fixed session table creation (`ensureSessionTable()` at startup) |
| 2026-05-03 | All | Full workspace typecheck passes clean (0 errors) |
| 2026-05-03 | Phase 2 | Added flat `GET/POST /api/projects` routes (spec-aligned); clientId in body for create |
| 2026-05-03 | Phase 1 | Fixed dashboard to return all 7 DashboardSummary fields (clusterCount, briefCount, pendingApprovals, aiTasksThisMonth) |
| 2026-05-03 | Phases 11–18 | Keyword adapters (Ahrefs, SEMrush, DataForSEO) with mock fallback |
| 2026-05-03 | Phases 11–18 | Real AI provider (OpenAI GPT-4o-mini) for clustering + brief generation |
| 2026-05-03 | Phases 11–18 | Audit log backend (table + helper + route + frontend page) |
| 2026-05-03 | Phases 11–18 | Team management (invite flow, seat enforcement, role changes, removal) |
| 2026-05-03 | Phases 11–18 | API key system (bcrypt hash, rm_ prefix, keyPrefix, revocation) |
| 2026-05-03 | Phases 11–18 | Webhook system (HMAC-SHA256, 9 events, delivery tracking, test endpoint) |
| 2026-05-03 | Phases 11–18 | Integration credentials system (upsert, keyword search, provider delete) |
| 2026-05-03 | Phases 11–18 | Security hardening: helmet, express-rate-limit (global + auth), 2mb body limit |
| 2026-05-03 | Phases 11–18 | Frontend: 5 new pages (team, audit-log, api-keys, webhooks, integrations) + accept-invite |
| 2026-05-03 | Phases 11–18 | Sidebar: Platform + Workspace sections with all new nav links |
| 2026-05-03 | Phases 11–18 | customFetch exported from @workspace/api-client-react for use in new pages |
| 2026-05-03 | All | Full workspace typecheck passes clean (0 errors) across 4 packages |
| 2026-05-03 | All | Full E2E smoke test passes all 10 phases end-to-end |
| 2026-05-02 | Phase 0 | Phase 0 complete — all deliverables shipped, all checks passing |
| 2026-05-02 | Phase 0 | Initial scaffold — artifact created, docs written, tooling configured |

---

*Phases 0–10 complete. Ready for Phase 11+ (real AI integration, advanced reporting, billing enforcement).*

---

## Phase 19 — In-App Notification System — COMPLETE

- [x] `notifications` table (tenant_id, user_id, type, title, body, link, read_at)
- [x] `GET /api/notifications` — list all for current user (newest first)
- [x] `GET /api/notifications/unread-count` — badge count for sidebar
- [x] `PATCH /api/notifications/:id/read` — mark single notification read
- [x] `PATCH /api/notifications/read-all` — mark all unread read
- [x] `DELETE /api/notifications/:id` — dismiss notification
- [x] `createNotification()` helper exported for use by other routes
- [x] Sidebar notification bell with live unread badge (30s polling)
- [x] `/notifications` frontend page (read/dismiss/mark-all)

---

## Phase 20 — Content Calendar — COMPLETE

- [x] `content_calendar_entries` table (project, brief link, status, due_date, assigned_to)
- [x] `GET /api/projects/:id/calendar` — list entries (optional month/year filter)
- [x] `POST /api/projects/:id/calendar` — create entry
- [x] `PATCH /api/projects/:id/calendar/:id` — update entry
- [x] `DELETE /api/projects/:id/calendar/:id` — delete entry
- [x] Statuses: planned → in_progress → review → published

---

## Phase 21 — Comments & Collaboration — COMPLETE

- [x] `comments` table (polymorphic: entity_type + entity_id, tenant-scoped)
- [x] `GET /api/comments?entityType=&entityId=` — list comments with user info
- [x] `POST /api/comments` — create comment (any authenticated user)
- [x] `PATCH /api/comments/:id/resolve` — resolve thread
- [x] `DELETE /api/comments/:id` — owner or admin can delete
- [x] Supports entity_types: cluster, brief, project, keyword

---

## Phase 22 — Competitor Analysis & Keyword Gap — COMPLETE

- [x] `competitor_domains` table (project-scoped)
- [x] `GET /api/projects/:id/competitors` — list tracked domains
- [x] `POST /api/projects/:id/competitors` — add domain
- [x] `DELETE /api/projects/:id/competitors/:id` — remove domain
- [x] `GET /api/projects/:id/competitors/keyword-gap` — keyword gap analysis (mock position data)
- [x] `/competitors` frontend page — domain list + keyword gap table

---

## Phase 23 — Rank Tracking — COMPLETE

- [x] `keyword_rankings` table (keyword_id, position, url, checked_at)
- [x] `GET /api/projects/:id/rankings` — latest position per keyword
- [x] `GET /api/projects/:id/rankings/:keywordId/history` — position history (90 days)
- [x] `POST /api/projects/:id/rankings/check` — record manual check
- [x] `POST /api/projects/:id/rankings/check-all` — mock bulk check (random positions)
- [x] `/rankings` frontend page — position table with Top 10 / Top 30 summary

---

## Phase 24 — Email Notification System — COMPLETE

- [x] `lib/email.ts` — SMTP transport (nodemailer) + mock fallback when SMTP_HOST not set
- [x] `sendEmail(payload)` — never throws; logs mock send if SMTP unconfigured
- [x] `inviteEmailHtml()` — invite email template
- [x] `reportReadyEmailHtml()` — report ready email template
- [x] Feature-flagged: works without any SMTP config

---

## Phase 25 — Advanced Analytics Dashboard — COMPLETE

- [x] `GET /api/analytics/overview` — totals (clients, projects, keywords, clusters, briefs, reports, AI tasks)
- [x] `GET /api/analytics/projects` — per-project keyword/cluster/brief counts
- [x] `GET /api/analytics/velocity` — keywords added per day (30-day window)
- [x] `/analytics` frontend page — metric cards, velocity bar chart, brief pipeline, per-project breakdown

---

## Phase 26 — Bulk Data Export — COMPLETE

- [x] `GET /api/projects/:id/export/keywords.csv` — CSV export of all project keywords
- [x] `GET /api/projects/:id/export/project.json` — Full project JSON export (keywords, clusters, briefs, reports, score settings)
- [x] `toCSV()` helper — RFC 4180 compliant, handles quoting and escaping

---

## Phase 27 — Project Templates — COMPLETE

- [x] `project_templates` table (name, description, config JSONB, created_by)
- [x] `GET /api/templates` — list tenant templates
- [x] `POST /api/templates` — create blank template
- [x] `POST /api/projects/:id/save-as-template` — snapshot project score settings as template
- [x] `PATCH /api/templates/:id` — update template
- [x] `DELETE /api/templates/:id` — delete template
- [x] `/templates` frontend page — template card grid with create dialog

---

## Phase 28 — Custom Fields — COMPLETE

- [x] `custom_fields` table (entity_type, name, slug, field_type, options, is_required)
- [x] `custom_field_values` table (upsert pattern)
- [x] `GET /api/custom-fields?entityType=` — list fields by entity
- [x] `POST /api/custom-fields` — create field
- [x] `DELETE /api/custom-fields/:id` — delete field + cascade values
- [x] `GET /api/custom-field-values?entityType=&entityId=` — get values for entity
- [x] `PUT /api/custom-field-values` — upsert value
- [x] `/custom-fields` frontend page — field manager per entity type

---

## Phase 29 — Full Project Data Export / Import — COMPLETE

- [x] CSV export (keywords) and JSON export (full project) from Phase 26
- [x] Export includes: project metadata, all keywords, clusters, briefs, reports, score settings
- [x] Download headers set correctly (Content-Disposition attachment)

---

## Phase 30 — Scheduled Reports — COMPLETE

- [x] `report_schedules` table (project, report_type, frequency, recipient_emails, next_send_at)
- [x] `GET /api/report-schedules` — list all schedules for tenant
- [x] `GET /api/projects/:id/report-schedules` — project-scoped schedules
- [x] `POST /api/report-schedules` — create schedule (daily/weekly/monthly)
- [x] `PATCH /api/report-schedules/:id` — update (toggle active, change frequency/emails)
- [x] `DELETE /api/report-schedules/:id` — delete schedule
- [x] `nextSendAt` auto-calculated on create/frequency change
- [x] `/report-schedules` frontend page — schedule list with toggle and create dialog

---

## Phase 31 — Usage Analytics & Plan Metering — COMPLETE

- [x] `GET /api/usage` — current plan, period, all usage counts vs. limits
- [x] Plan limits defined for: solo, starter, agency, enterprise
- [x] Tracks: keywords, briefs, AI tasks, seats, reports, API keys, webhook deliveries
- [x] `/usage` frontend page — progress bars with warning/critical colour states

---

## Phase 32 — GDPR Compliance Tools — COMPLETE

- [x] `GET /api/gdpr/export` — download all personal data as JSON (right of access)
- [x] `DELETE /api/gdpr/me` — anonymise account (right to erasure); blocks agency_admin self-delete
- [x] Audit log entry created on export and deletion
- [x] `/privacy` frontend page — data export + deletion with confirmation dialog
- [x] Data retention policy documented on page

---

## Phase 33 — Enhanced Health & Monitoring — COMPLETE

- [x] `GET /api/healthz` — fast health check (existing, unchanged)
- [x] `GET /api/healthz/detailed` — DB ping + latency, AI/SMTP status, uptime, memory (heapUsed, heapTotal, rss), version
- [x] Returns 503 if DB is unreachable
- [x] Smoke tested: DB latency ~1–2ms, memory reported correctly

---

## Phases 34–39 — Production Hardening — COMPLETE

### Security
- [x] Helmet (secure HTTP headers) — Phase 10 / security hardening
- [x] express-rate-limit (500/15min global, 20/15min auth) — Phase 10
- [x] 2MB body limit — Phase 10
- [x] bcrypt password hashing (cost 12) — Phase 1
- [x] HMAC-SHA256 webhook signatures — Phase 18
- [x] Tenant isolation on every DB query — all phases
- [x] Role-based access control (requireRole middleware) — Phase 1
- [x] API keys bcrypt-hashed at rest — Phase 17
- [x] GDPR account deletion + data export — Phase 32

### Observability
- [x] Pino structured logging (production JSON, dev pretty-print) — Phase 0
- [x] Request-scoped `req.log` — Phase 0
- [x] Detailed health endpoint with DB/AI/SMTP status and memory metrics — Phase 33
- [x] Audit log for all significant actions — Phase 15

### Data Integrity
- [x] Zod validation on all API inputs — all phases
- [x] Drizzle ORM + PostgreSQL with cascade rules — all phases
- [x] Session stored in PostgreSQL (connect-pg-simple) — Phase 1

### Developer Experience
- [x] TypeScript strict mode (0 errors across 4 workspace packages)
- [x] OpenAPI spec + codegen (api-client-react + api-zod) — Phase 0
- [x] pnpm workspace monorepo — Phase 0
- [x] Feature flags for AI, Stripe, SMTP, keyword adapters

---

## Phase 19–39 Smoke Tests — 2026-05-03

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/healthz/detailed` | ✅ 200 | DB ok 1ms, AI+SMTP mock-fallback |
| `POST /api/auth/register` | ✅ 201 | Session established |
| `GET /api/analytics/overview` | ✅ 200 | Returns all 7 totals |
| `GET /api/usage` | ✅ 200 | Plan=solo, correct limits |
| `GET /api/notifications` | ✅ 200 | [] empty array |
| `GET /api/templates` | ✅ 200 | [] empty array |
| `GET /api/custom-fields` | ✅ 200 | [] empty array |
| `GET /api/report-schedules` | ✅ 200 | [] empty array |
| TypeScript (all 4 packages) | ✅ 0 errors | |

---

## Change Log (continued)

| Date | Phase(s) | Change |
|------|----------|--------|
| 2026-05-03 | Phases 19–33 | 9 new DB tables (notifications, content_calendar_entries, comments, competitor_domains, keyword_rankings, project_templates, custom_fields, custom_field_values, report_schedules) |
| 2026-05-03 | Phases 19–33 | 13 new backend route files (notifications, calendar, comments, competitors, rankings, templates, custom-fields, export, report-schedules, analytics, usage, gdpr) |
| 2026-05-03 | Phases 19–33 | 9 new frontend pages (notifications, competitors, rankings, analytics, usage, templates, custom-fields, report-schedules, gdpr/privacy) |
| 2026-05-03 | Phase 24 | Email lib (nodemailer + mock fallback) with invite and report templates |
| 2026-05-03 | Phase 33 | Enhanced /api/healthz/detailed with DB latency, memory, and service status |
| 2026-05-03 | All | Sidebar expanded: Platform + Insights + Tools + Workspace + You sections |
| 2026-05-03 | All | Full workspace typecheck: 0 errors across all 4 packages |
