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

## Phases 11-39 - Canonical Roadmap

This section replaces the old generated placeholder roadmap for Phases 11-39. A phase is not considered complete until its deliverables are implemented, its acceptance criteria are verified, the relevant automated tests pass, at least one happy-path user journey has been exercised, and `ROADMAP_STATUS.md` is updated with evidence.

Phases 0-10 remain the historical foundation for the platform. Phases 11-39 are the canonical path from working product surface to production-ready operating platform.

---

## Phase 11 - Ahrefs Keyword Adapter

**Goal:** Add a real Ahrefs-backed keyword data provider without breaking the existing mock and manual workflows.

### Deliverables

- [ ] Add an Ahrefs provider adapter behind the existing keyword-provider abstraction.
- [ ] Add environment configuration for Ahrefs credentials and base URL.
- [ ] Preserve mock mode as the default when Ahrefs credentials are absent.
- [ ] Normalize Ahrefs responses into the shared keyword metrics shape.
- [ ] Support keyword lookup by seed term, locale, and optional project context.
- [ ] Handle rate limits, provider errors, partial responses, and empty result sets.
- [ ] Add provider-level logging that records request outcome without storing secrets.
- [ ] Add unit tests for mapping, validation, and fallback behavior.
- [ ] Add integration tests that can run with mocked Ahrefs responses.
- [ ] Document setup, required environment variables, and live-test expectations.

### Acceptance Criteria

- [ ] The app starts and keyword workflows still work with no Ahrefs credentials.
- [ ] With Ahrefs enabled, keyword discovery returns normalized metrics in the same API contract used by the UI.
- [ ] Provider errors produce actionable API errors and do not crash the workflow.
- [ ] Tests cover success, missing credentials, malformed provider data, and rate-limit paths.
- [ ] `ROADMAP_STATUS.md` records whether live Ahrefs credentials were available during verification.

---

## Phase 12 - Semrush Keyword Adapter

**Goal:** Add Semrush as a second real keyword data provider and make provider selection explicit and testable.

### Deliverables

- [ ] Add a Semrush provider adapter behind the shared keyword-provider abstraction.
- [ ] Add environment configuration for Semrush credentials, base URL, database, and locale defaults.
- [ ] Normalize Semrush volume, CPC, competition, trend, and related-keyword fields.
- [ ] Add provider selection rules for mock, Ahrefs, Semrush, and future providers.
- [ ] Add deterministic fallback behavior when the selected provider is unavailable.
- [ ] Add provider comparison fixtures to detect metric-shape drift.
- [ ] Add tests for Semrush mapping, missing credentials, bad provider responses, and fallback.
- [ ] Document the Semrush setup path and supported query modes.

### Acceptance Criteria

- [ ] The configured provider can be selected without code changes.
- [ ] Semrush output matches the shared keyword metrics API contract.
- [ ] Existing keyword workflows and tests keep passing when Semrush is disabled.
- [ ] Provider choice and provider failure are visible in logs without leaking secrets.
- [ ] `ROADMAP_STATUS.md` records mock, fixture, and any live-provider verification evidence.

---

## Phase 13 - DataForSEO Keyword Adapter

**Goal:** Replace the old "SEORx" placeholder with a concrete DataForSEO adapter and establish the final multi-provider keyword architecture.

### Deliverables

- [ ] Add a DataForSEO provider adapter for keyword ideas and metrics.
- [ ] Add environment configuration for DataForSEO credentials, base URL, language, and location.
- [ ] Normalize asynchronous or task-based provider responses into the shared keyword result model.
- [ ] Add retry and polling controls where the provider requires delayed result retrieval.
- [ ] Add clear timeout behavior for slow provider tasks.
- [ ] Add tests for queued, complete, failed, timed-out, and empty provider responses.
- [ ] Document provider-specific constraints such as locations, languages, and billing impact.
- [ ] Update provider documentation so Ahrefs, Semrush, DataForSEO, and mock mode are described together.

### Acceptance Criteria

- [ ] DataForSEO can be enabled through configuration and disabled safely.
- [ ] Long-running provider tasks cannot hang API requests indefinitely.
- [ ] The same UI workflow works across mock, Ahrefs, Semrush, and DataForSEO modes.
- [ ] Provider-specific errors are mapped into consistent user-facing states.
- [ ] `ROADMAP_STATUS.md` identifies DataForSEO as the canonical Phase 13 provider.

---

## Phase 14 - Real AI Providers

**Goal:** Connect production AI generation to real providers while keeping manual fallback and deterministic testability.

### Deliverables

- [ ] Add real AI provider adapters for configured model providers.
- [ ] Keep mock AI mode as the default when no provider credentials are present.
- [ ] Add per-workflow prompts for briefs, clusters, titles, meta descriptions, outlines, and recommendations.
- [ ] Add structured output validation for every AI response.
- [ ] Add retry, timeout, and fallback behavior for provider failures.
- [ ] Add cost, token, latency, and provider metadata tracking.
- [ ] Add redaction rules so prompts and logs do not expose secrets or sensitive tenant data unnecessarily.
- [ ] Add tests for mock mode, live-provider-disabled mode, schema validation failures, retries, and manual fallback.
- [ ] Document supported models, required environment variables, and expected failure behavior.

### Acceptance Criteria

- [ ] All AI-assisted workflows have a working non-AI manual path.
- [ ] Invalid AI output cannot corrupt project data.
- [ ] Provider failure gives the user a recoverable state.
- [ ] AI usage can be attributed to tenant, project, workflow, and provider.
- [ ] Test fixtures make AI workflows repeatable in CI without live credentials.

---

## Phase 15 - Audit Log System

**Goal:** Create an append-only audit trail for security, billing, administrative, and collaboration events.

### Deliverables

- [ ] Add audit log tables with tenant, actor, entity, action, timestamp, metadata, and request context.
- [ ] Add server-side audit helpers so routes can record events consistently.
- [ ] Capture authentication, team membership, project, billing, API key, webhook, export, and admin events.
- [ ] Add filtering by tenant, actor, entity type, action, and date range.
- [ ] Add access controls so audit logs are visible only to authorized roles.
- [ ] Add retention configuration and documented retention defaults.
- [ ] Add tests proving tenant isolation and append-only behavior.
- [ ] Add UI surfaces for admins to review audit history.

### Acceptance Criteria

- [ ] Sensitive events are recorded without storing secrets or raw payment details.
- [ ] Audit records cannot be edited through normal application APIs.
- [ ] Users cannot see audit events from another tenant.
- [ ] At least one event is recorded for each critical administrative and billing workflow.
- [ ] `ROADMAP_STATUS.md` lists the audited event categories verified.

---

## Phase 16 - Team Management

**Goal:** Support production-grade teams, roles, invites, and membership lifecycle across tenants.

### Deliverables

- [ ] Add team membership models for owners, admins, editors, viewers, and future custom roles.
- [ ] Add invite creation, resend, accept, expire, and revoke flows.
- [ ] Add role-change and member-removal workflows with audit logging.
- [ ] Enforce role permissions on the server for projects, keywords, exports, billing, and settings.
- [ ] Add UI for team list, pending invites, role changes, and member removal.
- [ ] Add tests for invite lifecycle, role enforcement, and tenant isolation.
- [ ] Add documentation for role capabilities and security expectations.

### Acceptance Criteria

- [ ] A tenant owner can invite a teammate and the teammate can join the correct tenant.
- [ ] Revoked or expired invites cannot be used.
- [ ] Lower-privilege users cannot access owner/admin-only routes through direct API calls.
- [ ] Membership changes are audit logged.
- [ ] Existing single-user tenant behavior remains intact.

---

## Phase 17 - API Key System

**Goal:** Provide secure public API access for customers and integrations.

### Deliverables

- [ ] Add API key models with hashed key storage, prefixes, scopes, status, last-used timestamp, and optional expiration.
- [ ] Add API key creation, reveal-once, rotation, revoke, and list flows.
- [ ] Add scoped authorization middleware for public API routes.
- [ ] Add rate limiting and usage attribution by API key.
- [ ] Add audit logging for key lifecycle and sensitive API usage.
- [ ] Add UI for managing keys and reviewing recent usage.
- [ ] Add OpenAPI documentation for authenticated public API access.
- [ ] Add tests for key creation, hashing, scope enforcement, revocation, expiration, and tenant isolation.

### Acceptance Criteria

- [ ] Raw API keys are never stored after creation.
- [ ] Revoked or expired keys stop working immediately.
- [ ] API scopes are enforced server-side.
- [ ] Public API usage is visible to tenant admins.
- [ ] The generated API documentation matches the implemented behavior.

---

## Phase 18 - Webhook System

**Goal:** Let customers and integrations receive reliable outbound events from RankMap.

### Deliverables

- [ ] Add webhook endpoint models with URL, event subscriptions, signing secret, status, and retry settings.
- [ ] Add event dispatch for project, keyword, report, billing, API key, and team events where appropriate.
- [ ] Sign outbound webhook payloads and document verification.
- [ ] Add delivery attempts, retry backoff, timeout handling, and dead-letter state.
- [ ] Add UI for endpoint creation, event selection, secret rotation, delivery logs, and replay.
- [ ] Add tests for signing, retries, failures, disabled endpoints, and tenant isolation.
- [ ] Add documentation with sample payloads and signature verification examples.

### Acceptance Criteria

- [ ] Webhook deliveries are signed and replayable by authorized tenant admins.
- [ ] Failed deliveries do not block the originating user workflow.
- [ ] Repeated failures can disable an endpoint without losing delivery history.
- [ ] Payloads never include secrets or unrelated tenant data.
- [ ] Webhook events are audit logged.

---

## Phase 19 - In-App Notification System

**Goal:** Add an in-app notification center for important platform, project, collaboration, billing, and integration events.

### Deliverables

- [ ] Add notification models with recipient, tenant, type, severity, read state, and linked entity.
- [ ] Add server helpers for creating notifications from product events.
- [ ] Add notification center UI with unread count, filtering, mark-read, and mark-all-read.
- [ ] Add notification preferences by category where useful.
- [ ] Add tests for notification creation, read state, tenant isolation, and permissions.
- [ ] Add audit logging for security-sensitive notification preference changes.

### Acceptance Criteria

- [ ] Users see only notifications intended for their tenant and role.
- [ ] Important system events surface in the notification center without relying on email.
- [ ] Read state persists correctly across sessions.
- [ ] Notifications link to the relevant project, report, or settings screen when possible.
- [ ] Notification volume is controlled so normal workflows do not spam users.

---

## Phase 20 - Content Calendar

**Goal:** Turn keyword and brief work into an editorial planning surface.

### Deliverables

- [ ] Add content item models for planned, assigned, drafting, reviewing, approved, scheduled, and published states.
- [ ] Add calendar views by month, week, and list.
- [ ] Link content items to projects, keyword clusters, briefs, assignees, and due dates.
- [ ] Add drag-and-drop or direct date editing for scheduling.
- [ ] Add status transitions with role checks and audit logging.
- [ ] Add tests for CRUD, scheduling, status changes, filtering, and tenant isolation.
- [ ] Add documentation for how content calendar data relates to existing project data.

### Acceptance Criteria

- [ ] A user can create a content item from a keyword or cluster and schedule it.
- [ ] Calendar changes persist and remain scoped to the tenant.
- [ ] Role permissions prevent unauthorized edits.
- [ ] Calendar state is reflected in relevant project and brief screens.
- [ ] Empty, loading, and error states are handled cleanly.

---

## Phase 21 - Comments and Collaboration

**Goal:** Add contextual collaboration to projects, keywords, briefs, and calendar items.

### Deliverables

- [ ] Add comments with tenant, author, target entity, body, created/updated timestamps, and soft-delete state.
- [ ] Add threaded replies or a documented single-thread model.
- [ ] Add mentions for teammates with in-app notifications.
- [ ] Add assignment support where comments create or reference actionable follow-up.
- [ ] Add UI for comment lists, compose, edit, delete, resolve, and mention flows.
- [ ] Add tests for permissions, mentions, notifications, soft deletion, and tenant isolation.
- [ ] Add audit logging for deleted comments and sensitive collaboration actions.

### Acceptance Criteria

- [ ] Users can collaborate directly inside the work item they are reviewing.
- [ ] Mentioned users receive a notification.
- [ ] Deleted comments do not disappear in a way that breaks context or audit needs.
- [ ] Users cannot comment on or view entities outside their tenant.
- [ ] Collaboration does not block existing project workflows.

---

## Phase 22 - Competitor Analysis and Keyword Gap

**Goal:** Add competitor discovery and keyword-gap workflows that help users prioritize opportunities.

### Deliverables

- [ ] Add competitor models linked to projects and domains.
- [ ] Add competitor keyword import or provider-backed discovery.
- [ ] Add keyword-gap calculations comparing project targets against competitor visibility.
- [ ] Add opportunity scoring using volume, difficulty, intent, and existing coverage.
- [ ] Add UI for competitor list, gap table, filters, and prioritization actions.
- [ ] Add export support for gap results.
- [ ] Add tests for scoring, filtering, provider fallback, and tenant isolation.

### Acceptance Criteria

- [ ] A project can track competitors and show missing or under-covered keyword opportunities.
- [ ] Gap results can be filtered, sorted, and promoted into the normal project workflow.
- [ ] Provider failures do not erase existing competitor data.
- [ ] Calculations are deterministic in tests.
- [ ] Tenant isolation is enforced for all competitor data.

---

## Phase 23 - Rank Tracking

**Goal:** Track keyword ranking performance over time and expose trend data to users.

### Deliverables

- [ ] Add tracked keyword models with search engine, locale, device, target URL, and schedule settings.
- [ ] Add rank snapshot storage with position, URL, SERP metadata, and collection timestamp.
- [ ] Add provider abstraction for rank collection with mock and real-provider support.
- [ ] Add scheduled collection job with retry and failure handling.
- [ ] Add UI for tracked keywords, ranking trends, winners/losers, and latest positions.
- [ ] Add tests for snapshot storage, trend calculations, scheduled job behavior, and tenant isolation.
- [ ] Document provider setup, schedule expectations, and cost controls.

### Acceptance Criteria

- [ ] Users can add keywords to tracking and view current plus historical position data.
- [ ] Failed collection attempts are visible and retryable.
- [ ] Trend calculations are stable and tested.
- [ ] Rank data is scoped by tenant and project.
- [ ] Mock tracking mode works in development and CI.

---

## Phase 24 - Email Notification System

**Goal:** Add production email notifications for account, collaboration, billing, report, and operational events.

### Deliverables

- [ ] Add email provider abstraction with mock mode and at least one real provider.
- [ ] Add templated emails for invites, mentions, report delivery, billing events, and security events.
- [ ] Add email preference management by notification category.
- [ ] Add bounce/failure handling where supported by provider.
- [ ] Add unsubscribe or preference links where appropriate.
- [ ] Add tests for template rendering, preference enforcement, provider fallback, and tenant isolation.
- [ ] Document required environment variables and live-test steps.

### Acceptance Criteria

- [ ] Email workflows work in mock mode without real provider credentials.
- [ ] Real email sending can be enabled by configuration.
- [ ] User preferences are respected before sending non-critical email.
- [ ] Security and billing emails are sent according to documented rules.
- [ ] Email failures are logged without breaking the originating workflow.

---

## Phase 25 - Advanced Analytics Dashboard

**Goal:** Give teams a consolidated, decision-grade view of project, keyword, content, ranking, usage, and business outcomes.

### Deliverables

- [ ] Define analytics event and metric models for product activity and SEO workflow performance.
- [ ] Add aggregation queries for project progress, keyword pipeline, rank changes, content calendar status, and provider usage.
- [ ] Add dashboard UI with filters by tenant, project, date range, owner, and status.
- [ ] Add exportable chart/table data where useful.
- [ ] Add performance safeguards for large tenants and long date ranges.
- [ ] Add tests for aggregations, filters, permissions, and empty states.
- [ ] Document metric definitions so dashboard numbers are explainable.

### Acceptance Criteria

- [ ] Dashboard numbers match documented metric definitions.
- [ ] Users can filter analytics without accessing unrelated tenant data.
- [ ] Large result sets do not make the dashboard unusable.
- [ ] Empty and partial-data states are understandable.
- [ ] Key analytics are covered by deterministic tests.

---

## Phase 26 - Bulk Keyword Export

**Goal:** Let users export keyword, cluster, gap, and rank data in practical bulk formats.

### Deliverables

- [ ] Add export jobs for CSV and JSON keyword datasets.
- [ ] Support filters for project, cluster, intent, difficulty, opportunity score, rank state, and date range.
- [ ] Add background processing for large exports.
- [ ] Add download links with expiration and tenant-scoped authorization.
- [ ] Add audit logging for exports.
- [ ] Add tests for export content, filters, authorization, expiration, and large-job behavior.
- [ ] Document export limits and supported formats.

### Acceptance Criteria

- [ ] Users can export filtered keyword data without timing out normal API requests.
- [ ] Exported files include only authorized tenant data.
- [ ] Large exports run as jobs and expose clear status.
- [ ] Download links cannot be guessed or reused after expiration.
- [ ] Export actions are audit logged.

---

## Phase 27 - Project Templates

**Goal:** Let teams standardize repeatable SEO workflows through reusable project templates.

### Deliverables

- [ ] Add template models for project structure, default tasks, statuses, fields, brief settings, and calendar defaults.
- [ ] Add create-from-template workflow.
- [ ] Add template creation from an existing project.
- [ ] Add template edit, duplicate, archive, and restore flows.
- [ ] Add permission checks for template management.
- [ ] Add tests for template application, versioning behavior, permissions, and tenant isolation.
- [ ] Document recommended template structure and limitations.

### Acceptance Criteria

- [ ] A user can create a project from a template and receive the expected starting structure.
- [ ] Template changes do not unexpectedly mutate already-created projects unless explicitly supported.
- [ ] Archived templates cannot be used for new projects.
- [ ] Template permissions are enforced server-side.
- [ ] Template usage is represented in audit logs where appropriate.

---

## Phase 28 - Custom Fields

**Goal:** Give teams controlled flexibility to capture tenant-specific workflow data.

### Deliverables

- [ ] Add custom field definitions with name, type, validation rules, target entity, order, and active state.
- [ ] Support text, number, select, multi-select, date, boolean, URL, and user reference field types where feasible.
- [ ] Add custom field values for projects, keywords, content items, and briefs as appropriate.
- [ ] Add UI for field management and entity-level editing.
- [ ] Add filtering and export support for custom fields where useful.
- [ ] Add tests for validation, permissions, filtering, exports, and tenant isolation.
- [ ] Document type behavior and migration expectations.

### Acceptance Criteria

- [ ] Tenant admins can define fields without code changes.
- [ ] Invalid field values are rejected server-side.
- [ ] Custom fields remain scoped to the tenant that created them.
- [ ] Field changes do not corrupt existing entity data.
- [ ] Supported custom fields appear in exports and relevant UI surfaces.

---

## Phase 29 - Full Project Data Export

**Goal:** Provide comprehensive project-level exports for customer portability, backup, and handoff.

### Deliverables

- [ ] Add project export jobs that include project metadata, keywords, clusters, briefs, comments, content calendar items, ranks, custom fields, and selected audit references where appropriate.
- [ ] Support JSON as the canonical machine-readable export format.
- [ ] Support a human-readable package format where practical.
- [ ] Add background processing, progress state, failure state, and retry.
- [ ] Add signed or tenant-scoped download links with expiration.
- [ ] Add audit logging for all project exports.
- [ ] Add tests for export shape, permissions, large projects, expiration, and tenant isolation.
- [ ] Document exactly what is and is not included in full exports.

### Acceptance Criteria

- [ ] A tenant admin can export a complete project without blocking the app.
- [ ] Exports include all documented project-owned data.
- [ ] Unauthorized users cannot generate or download exports.
- [ ] Export packages do not include secrets or unrelated tenant data.
- [ ] Large project exports are reliable and observable.

---

## Phase 30 - Scheduled Reports

**Goal:** Automate recurring delivery of project, rank, keyword, and analytics reports.

### Deliverables

- [ ] Add scheduled report models with report type, recipients, cadence, filters, status, and next-run time.
- [ ] Add report generation jobs with retry, failure state, and delivery history.
- [ ] Support email delivery and downloadable report artifacts.
- [ ] Add UI for creating, editing, pausing, resuming, and previewing schedules.
- [ ] Add permission checks and audit logging.
- [ ] Add tests for scheduling, permissions, report generation, delivery, and tenant isolation.
- [ ] Document report types, cadence rules, and delivery expectations.

### Acceptance Criteria

- [ ] Users can schedule a recurring report and receive it through the configured channel.
- [ ] Paused schedules do not run.
- [ ] Failed report runs are visible and retryable.
- [ ] Reports include only data the tenant is authorized to access.
- [ ] Scheduled report creation and changes are audit logged.

---

## Phase 31 - Usage Analytics and Plan Metering

**Goal:** Tie product usage to subscription plans, limits, billing operations, and customer visibility.

### Deliverables

- [ ] Define metered resources such as projects, tracked keywords, AI generations, provider lookups, exports, users, API calls, and webhooks.
- [ ] Add usage counters and event ingestion with tenant and plan attribution.
- [ ] Add plan limit enforcement with soft warnings and hard blocks where appropriate.
- [ ] Add admin and customer-facing usage views.
- [ ] Add billing integration hooks for usage-based plans if needed.
- [ ] Add tests for counters, resets, limits, billing events, and tenant isolation.
- [ ] Document plan limits, reset windows, and overage behavior.

### Acceptance Criteria

- [ ] Usage counts are accurate enough to enforce documented plan limits.
- [ ] Users can see current usage before hitting limits.
- [ ] Plan changes update available limits without manual database edits.
- [ ] Limit enforcement happens server-side.
- [ ] Usage events are observable and auditable.

---

## Phase 32 - GDPR Compliance Tools

**Goal:** Add privacy controls for data export, deletion, retention, consent, and user-rights workflows.

### Deliverables

- [ ] Map personal data stored by the platform and document retention categories.
- [ ] Add user data export workflow for authorized requests.
- [ ] Add deletion or anonymization workflow for eligible personal data.
- [ ] Add consent and preference records where relevant.
- [ ] Add retention enforcement jobs for eligible records.
- [ ] Add admin UI for privacy requests and completion evidence.
- [ ] Add audit logging for privacy actions.
- [ ] Add tests for export, deletion/anonymization, authorization, retention, and tenant isolation.
- [ ] Document operational process for privacy requests.

### Acceptance Criteria

- [ ] Authorized users can produce a personal-data export.
- [ ] Eligible personal data can be deleted or anonymized without breaking required business records.
- [ ] Privacy actions are audit logged.
- [ ] Unauthorized users cannot trigger or view privacy workflows.
- [ ] Retention behavior is documented and test-covered.

---

## Phase 33 - Enhanced Health and Monitoring

**Goal:** Expand health checks from basic uptime into meaningful readiness, dependency, and operational monitoring.

### Deliverables

- [ ] Add readiness checks for database, migrations, configured providers, queue workers, email, storage, Stripe, and webhook dispatch.
- [ ] Add liveness checks that are safe for load balancers.
- [ ] Add structured health output that separates required and optional dependencies.
- [ ] Add startup configuration validation for production-required services.
- [ ] Add metrics for request rate, latency, error rate, job outcomes, provider latency, and queue depth.
- [ ] Add alerting recommendations and deployment documentation.
- [ ] Add tests for healthy, degraded, and unhealthy states.

### Acceptance Criteria

- [ ] Health endpoints distinguish liveness from readiness.
- [ ] Missing production-required configuration fails clearly before launch.
- [ ] Optional service failures are reported as degraded when the app can still serve core traffic.
- [ ] Monitoring output is machine-readable and safe to expose to infrastructure.
- [ ] Operational documentation names the signals that should trigger investigation.

---

## Phase 34 - Security Hardening

**Goal:** Close production security gaps across authentication, authorization, data handling, headers, dependencies, and abuse prevention.

### Deliverables

- [ ] Complete an application threat model covering tenants, billing, providers, exports, API keys, webhooks, and background jobs.
- [ ] Add or verify secure headers, CORS policy, request body limits, and cookie/session settings.
- [ ] Add rate limits for authentication, public API, webhook management, export generation, and AI/provider-heavy routes.
- [ ] Verify all sensitive routes enforce server-side tenant and role checks.
- [ ] Add dependency vulnerability scanning to CI.
- [ ] Add secret scanning and hardcoded-secret prevention to CI.
- [ ] Add tests for representative authorization bypass attempts.
- [ ] Document security controls and incident escalation basics.

### Acceptance Criteria

- [ ] No known critical or high dependency vulnerabilities remain without documented exception.
- [ ] Cross-tenant access attempts are blocked in tests for critical route families.
- [ ] Public and sensitive endpoints have appropriate rate limits.
- [ ] Security-sensitive configuration is documented and validated.
- [ ] Findings and remediations are recorded in `ROADMAP_STATUS.md`.

---

## Phase 35 - Observability and Incident Readiness

**Goal:** Make production behavior debuggable through logs, metrics, traces, runbooks, and incident procedures.

### Deliverables

- [ ] Standardize structured logging with request IDs, tenant IDs where safe, user IDs where safe, route, status, and latency.
- [ ] Add error tracking integration or documented adapter point.
- [ ] Add tracing or span-ready instrumentation for database, provider calls, background jobs, and external services.
- [ ] Add operational dashboards for API health, job health, provider health, billing events, and error trends.
- [ ] Add runbooks for common incidents: provider outage, failed migrations, Stripe webhook failures, queue backlog, email failures, and high error rates.
- [ ] Add tests or smoke checks for logging and monitoring instrumentation where feasible.
- [ ] Document log redaction rules.

### Acceptance Criteria

- [ ] A production incident can be correlated from user report to request, job, provider call, and error.
- [ ] Logs do not contain secrets, raw payment details, or API keys.
- [ ] Runbooks provide concrete first steps for the most likely incidents.
- [ ] Dashboards cover API, jobs, dependencies, and billing-critical flows.
- [ ] Observability setup is included in release documentation.

---

## Phase 36 - Database Migrations and Release Gate

**Goal:** Make schema changes and release promotion safe, repeatable, and verifiable.

### Deliverables

- [ ] Use generated migrations as the canonical database-change path.
- [ ] Add migration verification to local and CI workflows.
- [ ] Add a deployment preflight that checks environment, generated artifacts, migrations, and required production services.
- [ ] Document migration generation, review, application, rollback expectations, and release sequencing.
- [ ] Add CI jobs that run format, lint, typecheck, tests, API E2E, artifact drift checks, migration checks, and build.
- [ ] Add release checklist documentation for staging and production.
- [ ] Add clear handling for missing live-provider credentials in CI and local development.

### Acceptance Criteria

- [ ] A clean checkout can install, generate artifacts, apply migrations, run tests, and build without manual database edits.
- [ ] Generated API/client artifacts are checked for drift before release.
- [ ] Deployment preflight fails clearly when production-required settings are missing.
- [ ] Migration workflow is documented for both developers and operators.
- [ ] CI is a trustworthy release gate rather than a placeholder.

---

## Phase 37 - Browser E2E and Frontend Production QA

**Goal:** Verify the actual user experience across the main product journeys, not only the API layer.

### Deliverables

- [ ] Add browser E2E test framework and stable local test setup.
- [ ] Cover authentication or mocked-auth entry, onboarding, project creation, keyword discovery, clustering, brief generation, billing entry points, team settings, exports, and core navigation.
- [ ] Add accessibility checks for critical screens.
- [ ] Add responsive viewport checks for desktop and mobile.
- [ ] Add visual or screenshot checks for the most important states where practical.
- [ ] Add test data factories or seed flows that keep E2E tests deterministic.
- [ ] Add CI integration for browser E2E or a documented staged rollout if runtime is too high.
- [ ] Document known manual QA steps that automation cannot cover yet.

### Acceptance Criteria

- [ ] A new user can complete the core product journey in browser E2E.
- [ ] Critical UI screens render correctly on mobile and desktop.
- [ ] Broken navigation, missing buttons, and blocked workflows are caught before release.
- [ ] Accessibility issues on critical paths are either fixed or explicitly tracked.
- [ ] E2E test results are recorded in `ROADMAP_STATUS.md`.

---

## Phase 38 - Performance, Scalability, and Reliability

**Goal:** Prove the platform can handle realistic production load and recover gracefully from dependency failures.

### Deliverables

- [ ] Define performance budgets for API latency, page load, dashboard queries, exports, provider calls, and background jobs.
- [ ] Add load or stress tests for representative API and job workloads.
- [ ] Optimize slow queries and add indexes where evidence supports them.
- [ ] Add pagination, streaming, background work, or caching where needed for large datasets.
- [ ] Add failure-mode tests for provider outages, queue backlog, database contention, and slow external services.
- [ ] Add backup, restore, and recovery documentation for production data.
- [ ] Add capacity-planning notes for expected launch traffic.
- [ ] Record performance baseline results in `ROADMAP_STATUS.md`.

### Acceptance Criteria

- [ ] Core API endpoints meet documented latency targets under agreed load.
- [ ] Large exports and reports do not block normal interactive requests.
- [ ] Slow or failed providers degrade gracefully.
- [ ] Database indexes and query plans support expected tenant sizes.
- [ ] Backup and restore procedures are documented and tested at least once in a non-production environment.

---

## Phase 39 - Launch Readiness and Operational Handoff

**Goal:** Complete the final production-readiness pass and make the platform operable after launch.

### Deliverables

- [ ] Complete final product QA across all implemented customer-facing workflows.
- [ ] Complete security review, dependency review, and open-risk triage.
- [ ] Complete live integration verification for configured production services.
- [ ] Complete staging deployment and production deployment rehearsal.
- [ ] Finalize runbooks, release checklist, rollback plan, incident contacts, and support process.
- [ ] Confirm analytics, logging, monitoring, alerting, backups, and billing operations are live.
- [ ] Confirm legal, privacy, terms, and data-retention documentation are ready where applicable.
- [ ] Create a launch sign-off record with known limitations, residual risks, and owner approvals.
- [ ] Update `ROADMAP_STATUS.md` with final evidence and production readiness decision.

### Acceptance Criteria

- [ ] Every phase from 0-39 has a truthful status: complete, partially complete, blocked, deferred, or intentionally removed.
- [ ] No old generated claim is treated as evidence of completion.
- [ ] Critical launch workflows pass in staging with production-like configuration.
- [ ] Rollback and incident procedures are documented and understood by the operator.
- [ ] The platform has a clear go/no-go decision with named blockers and owners.

---

_Last updated: 2026-05-10 - canonical Phases 11-39 roadmap drafted._
