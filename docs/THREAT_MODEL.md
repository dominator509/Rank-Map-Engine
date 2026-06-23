# RankMap Threat Model

Last updated: 2026-05-31.

This document records the current application threat model for the Phase 34 security-hardening gate. It is scoped to the repository architecture described in `ARCHITECTURE.md` and the launch-readiness roadmap in `BUILD_ROADMAP.md`.

## System Boundary

RankMap is a multi-tenant SEO workflow application with:

- Browser users authenticated by server sessions.
- Customer API access authenticated by `rm_` bearer API keys.
- PostgreSQL as the system of record for tenants, users, sessions, projects, keywords, AI tasks, integrations, webhooks, audit logs, reports, exports, and billing state.
- Optional external providers for AI, keyword data, email, Stripe billing, and outbound customer webhooks.
- A same-origin React frontend served by the API deployment in production-style environments.

## Assets

| Asset | Sensitivity | Primary Controls |
|-------|-------------|------------------|
| Tenant data | High | Tenant-scoped queries, server-side RBAC, API-key scope checks |
| User sessions | High | HTTP-only cookies, PostgreSQL session store, production secure cookies |
| Password hashes | High | bcrypt hashing, no plaintext storage |
| API keys | High | Reveal once, bcrypt hash at rest, prefix lookup, revocation, expiration, scope enforcement |
| Integration credentials | High | AES-256-GCM encryption at rest, feature flags, mock fallback |
| Stripe events and billing state | High | Raw body signature verification, feature-gated checkout/portal, tenant matching by Stripe identifiers |
| Webhook signing secrets | High | Generated server-side, redacted from list responses, HMAC signed deliveries |
| Audit log | Medium/High | Tenant filtering, admin-only access, append-only through normal APIs |
| Exports and reports | High | Authenticated routes, tenant/project ownership checks, download attachment headers |
| Operational health | Medium | Public liveness only; detailed health requires token or super-admin session |

## Trust Boundaries

| Boundary | Entry Points | Threats | Existing Controls |
|----------|--------------|---------|-------------------|
| Public unauthenticated HTTP | `/auth/*`, `/billing/plans`, `/billing/webhook`, `/healthz` | brute force, malformed payloads, webhook spoofing, health data leakage | auth rate limits, body size limit, Zod validation, Stripe signature verification, public health is minimal |
| Authenticated browser session | all protected `/api/*` routes | horizontal tenant access, role escalation, CSRF-like state mutation, malformed payloads | `requireAuth`, `requireRole`, tenant-scoped DB predicates, same-site cookies, Zod validation |
| API key bearer auth | protected `/api/*` routes | leaked keys, overbroad scopes, expired/revoked key reuse, route mutation with read keys | bcrypt key hashes, prefix lookup, revocation/expiration checks, read/write method scope enforcement, API key management rate limit |
| External providers | OpenAI-compatible AI, Ahrefs, Semrush, DataForSEO, SMTP, Stripe API | provider outage, slow responses, malformed provider data, secret leakage in logs | feature flags, mock fallback, timeout controls, credential redaction expectations |
| Outbound webhooks | customer URLs | SSRF-like delivery targets, slow receivers, replay disputes, payload over-disclosure | URL validation, fetch timeout, HMAC signatures, delivery logging, tenant event scoping, webhook management rate limit |
| Database | application queries and migrations | SQL injection, cross-tenant query mistakes, migration drift | Drizzle parameterization, schema constraints, generated migrations, route-drift and type gates |
| Operational tooling | CI, preflight, staging smoke/load, backups | secret commits, vulnerable dependencies, untested release artifacts | `security:check`, OpenAPI drift gate, generated artifact checks, backup/restore baseline |

## Representative Abuse Cases

| Abuse Case | Expected Result | Evidence |
|------------|-----------------|----------|
| Unauthenticated user calls protected customer data route | `401 Unauthorized`, handler does not run | `auth.security.test.ts` |
| Authenticated low-privilege user calls admin-only mutation | `403 Forbidden`, handler does not run | `auth.security.test.ts` |
| API-key session has malformed scopes | `403 Forbidden`, fail closed | `auth.security.test.ts` |
| Read-only API key attempts state mutation | `403 Forbidden`, handler does not run | `auth.security.test.ts` |
| Read-only API key calls read endpoint | request proceeds | `auth.security.test.ts` |
| API route added without OpenAPI contract | CI fails | `api:route-drift:check` |
| High/critical vulnerable dependency introduced | CI fails | `security:audit` |
| High-confidence secret pattern committed | CI fails | `security:secrets` |
| API key, provider search, or billing webhook endpoint is hammered | scoped route-family limiter returns `429` before route-specific handler work continues | `app.rate-limits.test.ts` |
| User from Tenant B requests Tenant A project-owned route families | `404` for client-project, keyword, cluster, brief, report, calendar, competitor, ranking, schedule, and export routes | `api.e2e.test.ts` |

## Residual Risks And Follow-Ups

| Risk | Status | Next Step |
|------|--------|-----------|
| Full cross-tenant integration coverage is not present for every route family | Partially mitigated | Expand API E2E and mocked route tests by route family, prioritizing exports, custom fields, reports, webhooks, and billing |
| Public/sensitive endpoint rate limits are broad rather than route-family-specific | Mitigated for current sensitive families | Tune thresholds from hosted traffic data and add new scoped limiters whenever new sensitive route families are introduced |
| Outbound webhook delivery policy lacks retry backoff/dead-letter hardening evidence | Partially mitigated | Add replay/retry/failure tests and document customer verification examples |
| External live-provider behavior is not fully verified in this local environment | Blocked on credentials/quota | Run `pnpm run test:live:services` with staging credentials before launch |
| Production monitoring/alerting is not attached to this repo-local evidence | External launch blocker | Attach hosted dashboards and alert policies to `docs/LAUNCH_READINESS.md` |
| Incident owner and deployment owner are not named | External launch blocker | Fill production owner rows in `docs/LAUNCH_READINESS.md` |

## Security Review Cadence

- Update this threat model when a new public route family, authentication mode, provider, export surface, webhook event, or background worker is added.
- Run `pnpm run security:check` before release and after dependency changes.
- Add at least one authorization-bypass regression test for each new sensitive route family.
