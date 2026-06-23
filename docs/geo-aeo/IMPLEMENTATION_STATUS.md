# GEO/AEO Implementation Status

## Current GEO/AEO Phase

G2 - Shared Domain Constants, Schemas, and Scoring

## Current Task

Create canonical GEO/AEO docs, add safe feature flags, and add the shared domain/scoring foundation.

## Discovery Note

1. Current app framework and route structure: React/Vite frontend in `artifacts/rankmap/src`, Express 5 API in `artifacts/api-server/src/routes`, mounted through `routes/index.ts`.
2. ORM/database/migration approach: PostgreSQL plus Drizzle schemas in `lib/db/src/schema`; generated migrations in `lib/db/drizzle`.
3. Existing auth/session approach: Express sessions stored in Postgres; optional API key auth can populate `req.session.user`.
4. Existing RBAC and permission helpers: `requireAuth` and `requireRole()` in `artifacts/api-server/src/middlewares/auth.ts`; API key scopes also gate method access.
5. Existing tenant scoping helpers: no global RLS wrapper found; route/service queries include `tenantId` filters from `req.session.user.tenantId`.
6. Existing audit log service: `audit()` in `artifacts/api-server/src/lib/audit.ts`, backed by `auditLogTable`.
7. Existing AI adapter/task-runner pattern: `aiTasksTable`, `enqueueAiTask()`, `runMockAiTask()`, and mock/openai fallback helpers in `ai-provider.ts`.
8. Existing integration adapter registry pattern: keyword provider adapters in `keyword-adapters.ts` with feature-flag checks and mock fallback.
9. Existing report/export engine pattern: project-scoped report and export routes under `routes/reports.ts` and `routes/export.ts`.
10. Current roadmap phase/status: Phase 39 launch-readiness reconciliation; current go/no-go remains no-go pending external hosted and operational evidence.
11. Existing test commands and CI conventions: `pnpm run test`, `typecheck`, `lint`, `test:e2e:api`, `test:e2e:browser`, `security:check`, `build`, route drift, and performance/recovery scripts.
12. Existing GEO/AEO module: no product code found; an untracked `docs/geo-aeo/GEO_AEO_*` planning pack already existed before this implementation block.

## Checkpoint - 2026-06-23

- Current task: add docs, env flags, and shared scoring/domain foundation.
- Acceptance criteria targeted: canonical docs exist; real calls default off; score formula is centralized and tested.
- Files expected to change: `.env.example`, `tsconfig.json`, `lib/shared/**`, `docs/geo-aeo/**`.
- Tests/checks to run: focused GEO/AEO Vitest, shared package typecheck, then broader typecheck if time permits.
- Rollback plan: remove `lib/shared`, remove the GEO/AEO env block, and remove canonical docs while leaving pre-existing `GEO_AEO_*` pack untouched.

## Phase Checklist

- [x] G0 discovery completed.
- [x] Canonical GEO/AEO docs created.
- [x] G1 env placeholders added.
- [x] G1 env validation foundation added.
- [x] G2 shared constants/schemas/scoring added.
- [ ] G3 database migration not started.
- [ ] G4 RBAC/audit route integration not started.
- [ ] G5 services/API routes not started.
- [ ] G6 prompt/snapshot workflow not started.
- [ ] G7 adapter registry not started.
- [ ] G8 AI task registry not started.
- [ ] G9 findings/action plans not started.
- [ ] G10 UI/reports/client dashboard not started.
- [ ] G11 hardening/smoke not started.

## Tests/Checks Run

| Command | Result | Notes |
|---|---|---|
| `corepack pnpm install` | Pass | Linked the new `@workspace/shared` workspace package. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | 8 GEO/AEO shared tests passed. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed. |
| `corepack pnpm run deploy:preflight` | Pass | Dry run only: migrations, live services, and deployed health check skipped; GEO/AEO env guardrails accepted manual/mock config. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings. |

## Known Limitations

- No database tables, API routes, UI pages, adapters, AI tasks, or reports have been implemented yet.
- The existing repo has substantial pre-existing uncommitted changes; this feature block must avoid reverting them.
- GEO/AEO is not production-ready and does not change the Phase 39 launch no-go status.
