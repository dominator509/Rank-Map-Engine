# RankMap — Build Roadmap

> **Source of Truth.** This document is the canonical execution plan for building RankMap, phase by phase. Follow this strictly. Do not skip phases. Update `ROADMAP_STATUS.md` after each phase.

---

## Operating Rules

1. **No skipping phases.** Each phase gates the next.
2. **No hardcoded secrets.** All secrets via environment variables. ESLint enforces this.
3. **Feature-flag real integrations.** Mock adapters must work without any real API keys.
4. **Manual fallback required.** Every AI workflow must have a non-AI manual path.
5. **Tests after each major block.** Run and document results in `ROADMAP_STATUS.md`.
6. **ROADMAP_STATUS.md stays current.** Update after every phase completion.
7. **Server-side RBAC.** Authorization enforced in route middleware, not client.
8. **Tenant isolation.** All DB queries must include `tenant_id` guard.
9. **Zod everywhere.** All API inputs/outputs validated with Zod schemas.
10. **No `console.log` in server code.** Use `req.log` / `logger` (pino).

---

## Phase 0 — Repository Initialization

**Goal:** Replit-ready TypeScript full-stack skeleton. No product features.

### Deliverables

- [x] `artifacts/rankmap` — React + Vite frontend (TypeScript, Tailwind, shadcn/ui)
- [x] `artifacts/api-server` — Express 5 API server (TypeScript, Pino)
- [x] `lib/db` — Drizzle ORM + PostgreSQL (schema placeholder)
- [x] `lib/api-spec` — OpenAPI spec (health endpoint only)
- [x] `lib/api-client-react` — Generated React Query hooks
- [x] `lib/api-zod` — Generated Zod schemas
- [ ] `.env.example` — Fake placeholders only, no real secrets
- [ ] `vitest.config.ts` — Vitest setup at workspace root
- [ ] `eslint.config.js` — ESLint with no-hardcoded-secrets rule
- [ ] `.prettierrc` — Prettier config
- [ ] `ARCHITECTURE.md` — Canonical architecture doc
- [ ] `BUILD_ROADMAP.md` — This file
- [ ] `ROADMAP_STATUS.md` — Phase tracking
- [ ] `README.md` — Project overview and setup guide
- [ ] `docs/SECURITY.md` — Security policy and practices
- [ ] `docs/ENV.md` — Environment variable reference
- [ ] `/api/healthz` — Health endpoint returning `{ status: "ok" }`
- [ ] Phase 0 skeleton UI (app shell, no features)

### Acceptance Criteria

- [ ] `pnpm run typecheck` passes with 0 errors
- [ ] `pnpm run lint` passes with 0 errors
- [ ] `pnpm run test` runs and reports (0 tests pass trivially)
- [ ] `GET /api/healthz` returns `{ status: "ok" }`
- [ ] Frontend loads at `/` showing skeleton shell
- [ ] No secrets committed (ESLint + `.gitignore` verified)
- [ ] All docs files present

---

## Phase 1 — Auth, RBAC, Tenant Isolation

**Goal:** Session-based auth with role-based access control and multi-tenant data isolation.

### Deliverables

- User table + Tenant table schema (Drizzle)
- Session middleware (express-session + connect-pg-simple)
- Register / Login / Logout routes
- RBAC middleware factory: `requireRole(role[])`
- Tenant isolation service layer guard
- Auth UI: login, register pages
- Protected route HOC on frontend

### Acceptance Criteria

- Unauthenticated requests to protected routes return 401
- Cross-tenant data access blocked (integration test)
- Role checks enforced server-side
- Session persists across page reload

---

## Phase 2 — Client & Project Management

**Goal:** CRUD for Clients and Projects with tenant scoping.

### Deliverables

- Client table + Project table schema
- REST endpoints: `/api/clients`, `/api/projects` (CRUD)
- Frontend: Clients list, Client detail, Projects list, Project detail
- Breadcrumb navigation

### Acceptance Criteria

- All CRUD operations work for authorized users
- Creating data as Tenant A is not visible to Tenant B
- Empty states are informative

---

## Phase 3 — Keyword Import Engine

**Goal:** Accept keywords from multiple sources, normalize, and store.

### Deliverables

- Keyword table schema
- Import adapters: manual entry, CSV upload, mock Ahrefs, mock Semrush
- Adapter registry with feature flags
- Deduplication service (phrase normalization, fuzzy match threshold)
- Keyword list UI with source badge

### Acceptance Criteria

- CSV with 1,000 keywords imports in < 5s
- Duplicates are detected and merged
- Real adapter imports blocked unless feature flag enabled
- Manual entry works without any integrations

---

## Phase 4 — Keyword Scoring Engine

**Goal:** Centralized, configurable scoring formula applied to all keywords.

### Deliverables

- `lib/scoring/keyword-score.ts` — scoring formula
- Score computed on import and on any field update
- Score displayed as progress bar in keyword list
- Per-project weight configuration UI

### Acceptance Criteria

- Formula is deterministic and unit-tested
- Weights sum to 1.0 (Zod validation)
- Updating KD/volume recalculates score
- Score breakdown visible on keyword detail

---

## Phase 5 — AI Clustering (Mock → Real)

**Goal:** Group keywords into topical clusters via AI task orchestration.

### Deliverables

- `AiTask` table schema
- Task registry: `cluster-keywords` task type
- Provider registry: `mock`, `openai` (feature-flagged)
- Mock adapter: rule-based clustering (always available)
- Human approval UI: approve / reject / re-cluster per cluster
- `KeywordCluster` table + assignment logic

### Acceptance Criteria

- Mock clustering works with `FEATURE_AI_CLUSTERING=false`
- Real clustering fires when `FEATURE_AI_CLUSTERING=true` + API key set
- Human approval gate blocks cluster application until approved
- Rejected clusters can be re-triggered

---

## Phase 6 — Topic Maps & Content Roadmaps

**Goal:** Visualize topical authority and generate a prioritized content calendar.

### Deliverables

- Pillar → Cluster → Keyword hierarchy data model
- Topical authority coverage score
- Topic map visualization (tree or graph)
- Content roadmap (prioritized list by score + cluster status)

### Acceptance Criteria

- Coverage % updates when clusters are approved/rejected
- Roadmap is sortable by priority, date, cluster
- Export roadmap to CSV

---

## Phase 7 — Content Briefs (AI + Manual)

**Goal:** Generate and manage content briefs per cluster.

### Deliverables

- `ContentBrief` table schema
- AI brief generation task (mock + real, feature-flagged)
- Manual brief editor (rich text or markdown)
- Brief approval workflow
- Brief detail page

### Acceptance Criteria

- Mock brief always generates (no API key required)
- Manual brief edit works without AI
- Brief status tracked (draft → approved → in-progress → published)

---

## Phase 8 — Reporting & Exports

**Goal:** Generate client-ready reports in PDF and CSV format.

### Deliverables

- Report types: Project Summary, Topical Authority, Content Pipeline
- PDF export (puppeteer or react-pdf)
- CSV export (papaparse)
- `Report` table (track generated reports)
- Report list UI per project

### Acceptance Criteria

- PDF renders with correct data, no layout breaks
- CSV exports valid for Excel/Google Sheets
- Reports linked to project and timestamped

---

## Phase 9 — Client Dashboard (White-Label Ready)

**Goal:** Read-only client portal with white-label configuration.

### Deliverables

- Client-role-restricted dashboard view
- White-label config: logo, colors, app name
- `white_label_config` on Tenant
- Client login flow (separate from agency login)
- `FEATURE_WHITE_LABEL` flag

### Acceptance Criteria

- Client role cannot access agency settings
- White-label branding applied to client portal
- Custom domain setup documented (manual DNS config)

---

## Phase 10 — Stripe Licensing & Billing

**Goal:** Subscription management with plan enforcement.

### Deliverables

- Stripe webhook handler: `customer.subscription.updated/deleted`
- Plan enforcement middleware: `requirePlan(plan)`
- Seat limit enforcement at user invite
- Usage tracking: AI task metering
- Billing settings UI (manage subscription, seat count)
- `FEATURE_STRIPE_BILLING` flag (manual plan assignment when off)

### Acceptance Criteria

- Downgraded plan blocks access to higher-tier features
- Over-seat invite returns 402
- Usage dashboard shows AI task count vs. limit
- Manual plan assignment works when Stripe flag is off

---

## Phases 11–39 — Future Phases (TBD)

Future phases will expand:
- Phase 11: Ahrefs real integration
- Phase 12: Semrush real integration
- Phase 13: SEORx integration
- Phase 14: Advanced AI providers (Anthropic)
- Phase 15: Audit log & compliance
- Phase 16: Team collaboration (comments, assignments)
- Phase 17: API access (public API keys for clients)
- Phase 18: Zapier / webhook integrations
- Phase 19–39: TBD based on roadmap evolution

Each will be detailed when the preceding phase is complete.

---

*Last updated: Phase 0 initialization.*
