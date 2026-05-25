# RankMap Workspace

## Overview

RankMap is an AI-powered SEO keyword research, content strategy, topical authority, reporting, client dashboard, and white-label agency SaaS. Built as a TypeScript pnpm monorepo — all 18 phases (0–18) complete and production-ready.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 18 + Vite + Tailwind v4 + shadcn/ui + wouter routing (`artifacts/rankmap`)
- **API framework**: Express 5 (`artifacts/api-server`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API contracts**: OpenAPI 3.0 spec (`lib/api-spec`)
- **API codegen**: Orval → React Query hooks (`lib/api-client-react`) + Zod schemas (`lib/api-zod`)
- **Scoring**: `lib/scoring` — centralized keyword scoring formula
- **Build**: esbuild (CJS bundle for API server)
- **Auth**: express-session + connect-pg-simple (PostgreSQL session store)
- **Billing**: Stripe (feature-flagged via `STRIPE_SECRET_KEY`)

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@workspace/rankmap` | `artifacts/rankmap` | React frontend |
| `@workspace/api-server` | `artifacts/api-server` | Express API |
| `@workspace/db` | `lib/db` | Drizzle schema + migrations |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI spec + codegen config |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated React Query hooks |
| `@workspace/api-zod` | `lib/api-zod` | Generated Zod schemas |
| `@workspace/scoring` | `lib/scoring` | Keyword scoring engine |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages (0 errors)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Express session secret (required)
- `STRIPE_SECRET_KEY` — Stripe secret (optional; billing feature-flags off without it)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (optional)
- `OPENAI_API_KEY` — OpenAI key (optional; AI clustering + brief generation fall back to mock without it)
- `AHREFS_API_KEY` — Ahrefs Keywords Explorer API key (optional; mock fallback)
- `SEMRUSH_API_KEY` — SEMrush API key (optional; mock fallback)
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` — DataForSEO credentials (optional; mock fallback)
- `APP_URL` — Public app URL (used in invite links; optional)
- `PORT` — Set by Replit per artifact

## Architecture Notes

- Session table auto-created at startup via `ensureSessionTable()` (bypasses connect-pg-simple esbuild issue)
- All routes are tenant-scoped via `req.session.user.tenantId`
- AI clustering: `lib/ai-provider.ts` uses OpenAI GPT-4o-mini if `OPENAI_API_KEY` set, otherwise mock
- Brief generation: same provider module — pulls cluster keywords for context before generating
- `POST /api/projects` accepts `clientId` in request body (spec-aligned flat route)
- Stripe billing is feature-flagged — returns 503 with helpful message if `STRIPE_SECRET_KEY` not set
- Webhook delivery uses HMAC-SHA256 (`X-RankMap-Signature`) with per-endpoint secret, 10s timeout
- API keys: `rm_` prefix + 64 hex chars, bcrypt-hashed at rest, keyPrefix (first 10 chars) shown in UI
- Team invites: 7-day expiry token stored in `user_invitations`, seat limit enforced before creation
- Security: `helmet` (secure headers) + `express-rate-limit` (500/15min global, 20/15min auth routes)
- Keyword adapters: Ahrefs, SEMrush, DataForSEO each have real API calls with mock fallback
- Integration credentials stored as encrypted JSONB in `integration_credentials` table (never logged/exposed in API)

## New Backend Files (Phases 11–18)

| File | Purpose |
|------|---------|
| `artifacts/api-server/src/lib/ai-provider.ts` | OpenAI + mock AI for clustering & briefs |
| `artifacts/api-server/src/lib/keyword-adapters.ts` | Ahrefs/SEMrush/DataForSEO adapters |
| `artifacts/api-server/src/lib/audit.ts` | `audit()` helper — never throws, logs actions |
| `artifacts/api-server/src/lib/webhook-emitter.ts` | HMAC-signed webhook dispatcher |
| `artifacts/api-server/src/routes/team.ts` | Team CRUD + invite flow + accept |
| `artifacts/api-server/src/routes/audit-log.ts` | Paginated audit log (admin only) |
| `artifacts/api-server/src/routes/api-keys.ts` | API key create/list/revoke |
| `artifacts/api-server/src/routes/webhooks.ts` | Webhook endpoint CRUD + test + deliveries |
| `artifacts/api-server/src/routes/integrations.ts` | Integration credentials + keyword search |

## New DB Schemas (Phases 11–18)

| Schema | Table |
|--------|-------|
| `lib/db/src/schema/audit-log.ts` | `audit_log` |
| `lib/db/src/schema/invitations.ts` | `user_invitations` |
| `lib/db/src/schema/api-keys.ts` | `api_keys` |
| `lib/db/src/schema/webhooks.ts` | `webhook_endpoints`, `webhook_deliveries` |
| `lib/db/src/schema/integrations.ts` | `integration_credentials` |

## New Frontend Pages (Phases 11–18)

| Route | File | Purpose |
|-------|------|---------|
| `/team` | `pages/team.tsx` | Members list + invite flow |
| `/audit-log` | `pages/audit-log.tsx` | Paginated activity log |
| `/api-keys` | `pages/api-keys.tsx` | Key management |
| `/webhooks` | `pages/webhooks.tsx` | Webhook endpoints + delivery log |
| `/integrations` | `pages/integrations.tsx` | Integration config cards |
| `/accept-invite` | `pages/accept-invite.tsx` | Token-based invite acceptance |

## New Backend Files (Phases 19–39)

| File | Purpose |
|------|---------|
| `artifacts/api-server/src/routes/notifications.ts` | In-app notifications CRUD + createNotification() helper |
| `artifacts/api-server/src/routes/calendar.ts` | Content calendar entries per project |
| `artifacts/api-server/src/routes/comments.ts` | Polymorphic comment threads (cluster/brief/project/keyword) |
| `artifacts/api-server/src/routes/competitors.ts` | Competitor domains + keyword gap analysis |
| `artifacts/api-server/src/routes/rankings.ts` | Rank tracking per keyword + bulk check |
| `artifacts/api-server/src/routes/templates.ts` | Project templates CRUD + save-from-project |
| `artifacts/api-server/src/routes/custom-fields.ts` | Custom metadata fields + value upsert |
| `artifacts/api-server/src/routes/export.ts` | CSV keyword export + full project JSON export |
| `artifacts/api-server/src/routes/report-schedules.ts` | Scheduled report delivery management |
| `artifacts/api-server/src/routes/analytics.ts` | Workspace analytics (overview, per-project, velocity) |
| `artifacts/api-server/src/routes/usage.ts` | Plan metering and usage dashboard data |
| `artifacts/api-server/src/routes/gdpr.ts` | GDPR data export + account deletion |
| `artifacts/api-server/src/lib/email.ts` | Email transport (nodemailer + mock fallback) |

## New DB Schemas (Phases 19–30)

| Schema | Table |
|--------|-------|
| `lib/db/src/schema/notifications.ts` | `notifications` |
| `lib/db/src/schema/calendar.ts` | `content_calendar_entries` |
| `lib/db/src/schema/comments.ts` | `comments` |
| `lib/db/src/schema/competitors.ts` | `competitor_domains` |
| `lib/db/src/schema/rankings.ts` | `keyword_rankings` |
| `lib/db/src/schema/templates.ts` | `project_templates` |
| `lib/db/src/schema/custom-fields.ts` | `custom_fields`, `custom_field_values` |
| `lib/db/src/schema/report-schedules.ts` | `report_schedules` |

## New Frontend Pages (Phases 19–39)

| Route | File | Purpose |
|-------|------|---------|
| `/notifications` | `pages/notifications.tsx` | Notification center with read/dismiss |
| `/competitors` | `pages/competitors.tsx` | Competitor tracking + keyword gap |
| `/rankings` | `pages/rankings.tsx` | Rank position monitoring |
| `/analytics` | `pages/analytics.tsx` | Cross-workspace analytics |
| `/usage` | `pages/usage.tsx` | Plan metering with usage bars |
| `/templates` | `pages/templates.tsx` | Project template library |
| `/custom-fields` | `pages/custom-fields.tsx` | Custom metadata manager |
| `/report-schedules` | `pages/report-schedules.tsx` | Scheduled report delivery |
| `/privacy` | `pages/gdpr.tsx` | GDPR data export + deletion |

## Phases Complete

All 39 phases (0–39) fully implemented and production-ready. See `ROADMAP_STATUS.md` for details.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
