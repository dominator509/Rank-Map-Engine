# RankMap — Roadmap Status

> Live tracking of phase completion. Updated after every phase.

---

## Current Phase: Phase 10 — COMPLETE

**Status:** ✅ Complete  
**Completed:** 2026-05-03  
**Next Phase:** Phase 11+ (Future)

---

## Phase Summary

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| 0 | Repository Initialization | ✅ Complete | 2026-05-02 |
| 1 | Auth, RBAC, Tenant Isolation | ✅ Complete | 2026-05-03 |
| 2 | Client & Project Management | ✅ Complete | 2026-05-03 |
| 3 | Keyword Import Engine | ✅ Complete | 2026-05-03 |
| 4 | Keyword Scoring Engine | ✅ Complete | 2026-05-03 |
| 5 | AI Clustering (Mock) | ✅ Complete | 2026-05-03 |
| 6 | Topic Maps & Content Roadmaps | ✅ Complete | 2026-05-03 |
| 7 | Content Briefs (AI + Manual) | ✅ Complete | 2026-05-03 |
| 8 | Reporting & Exports | ✅ Complete | 2026-05-03 |
| 9 | Client Dashboard (White-Label) | ✅ Complete | 2026-05-03 |
| 10 | Stripe Licensing & Billing | ✅ Complete | 2026-05-03 |
| 11–39 | Future Phases | ⏳ TBD | — |

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

## Frontend Checklist — Phases 1–10 UI — COMPLETE

- [x] `/login` — Sign in page with email + password
- [x] `/register` — Create account (email, password, fullName, tenantName)
- [x] `/dashboard` — Workspace metrics: clients, projects, keywords, clusters, briefs, AI tasks
- [x] `/clients` — Searchable client list with create/edit/delete
- [x] `/clients/:clientId` — Client detail + projects list with create/delete
- [x] `/clients/:clientId/projects/:projectId/:tab?` — Project detail with tab nav
- [x] `/ai-tasks` — AI task queue with live polling (5s), status badges
- [x] `/billing` — Subscription plan + usage metrics
- [x] `/settings` — Tenant name + white-label config
- [x] `useAuth()` hook — wraps `useGetCurrentUser`, returns `{user, isLoading, isAuthenticated}`
- [x] `ProtectedRoute` — Redirects to `/login` if not authenticated
- [x] Sidebar — Functional links (no "Soon" badges), active state highlighting

---

## Test Results — Phases 1–10

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm run typecheck` | ✅ Pass | 0 errors across all 4 artifacts |
| `GET /api/healthz` | ✅ Pass | Returns `{"status":"ok"}` |
| `POST /api/auth/register` | ✅ Pass | Creates user + tenant, returns session cookie |
| `POST /api/auth/login` | ✅ Pass | Authenticates, sets `connect.sid` cookie |
| `GET /api/auth/me` | ✅ Pass | Returns authenticated user via session |
| `POST /api/clients` | ✅ Pass | Creates client, tenant-scoped |
| Session persistence | ✅ Pass | PostgreSQL session store, table auto-created |
| Frontend loads at `/` | ✅ Pass | Redirects to `/login` when unauthenticated |
| Login page renders | ✅ Pass | Clean form, RankMap branding |
| Auth redirect | ✅ Pass | `ProtectedRoute` redirects to `/login` |
| No secrets committed | ✅ Pass | `.env.example` has fake values only |

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
| 2026-05-02 | Phase 0 | Phase 0 complete — all deliverables shipped, all checks passing |
| 2026-05-02 | Phase 0 | Initial scaffold — artifact created, docs written, tooling configured |

---

*Phases 0–10 complete. Ready for Phase 11+ (real AI integration, advanced reporting, billing enforcement).*
