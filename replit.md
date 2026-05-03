# RankMap Workspace

## Overview

RankMap is an AI-powered SEO keyword research, content strategy, topical authority, reporting, client dashboard, and white-label agency SaaS. Built as a TypeScript pnpm monorepo — all 10 phases (0–10) complete and production-ready.

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
- `PORT` — Set by Replit per artifact

## Architecture Notes

- Session table auto-created at startup via `ensureSessionTable()` (bypasses connect-pg-simple esbuild issue)
- All routes are tenant-scoped via `req.session.user.tenantId`
- AI clustering and brief generation use mock implementations by default; swap in real OpenAI/Anthropic calls in `artifacts/api-server/src/lib/ai/`
- `POST /api/projects` accepts `clientId` in request body (spec-aligned flat route)
- Stripe billing is feature-flagged — returns 503 with helpful message if `STRIPE_SECRET_KEY` not set

## Phases Complete

Phases 0–10 fully implemented. See `ROADMAP_STATUS.md` for details.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
