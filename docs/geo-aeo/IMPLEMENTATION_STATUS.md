# GEO/AEO Implementation Status

## Current GEO/AEO Phase

G16 - Monthly Monitoring Scaffold

## Current Task

Continue final hardening after adding route tests, service hardening tests, OpenAPI/codegen coverage, route-drift parity, dependency security upgrades, manual fallback API surfaces, and the monthly monitoring scaffold for manual recurring GEO/AEO progress runs.

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

- Current task: add deterministic action-plan generation and action item update routes.
- Acceptance criteria targeted: action plans generate from tenant-scoped findings, existing draft plans are superseded, fallback item exists when no findings are present, action item updates are tenant-scoped and audited.
- Files expected to change: `lib/shared/src/geo-aeo/schemas.ts`, `artifacts/api-server/src/lib/geo-aeo-service.ts`, `artifacts/api-server/src/routes/geo-aeo.ts`, `docs/geo-aeo/IMPLEMENTATION_STATUS.md`.
- Tests/checks to run: API server typecheck, shared typecheck/tests, full typecheck, lint.
- Rollback plan: remove action-plan route branches and service helpers; analysis/score/finding routes remain usable.

## Checkpoint - 2026-06-24

- Current task: G11 hardening for route parity, RBAC/approval/export tests, generated client coverage, and security-gate cleanup.
- Acceptance criteria targeted: explicit audit approval endpoint exists, client-role users only see approved client-dashboard data, clients cannot mutate/import/export operator-only resources, report CSV export neutralizes spreadsheet-leading formulas, OpenAPI route drift is zero, generated clients include GEO/AEO operations, and high-severity dependency audit findings are cleared.
- Files expected to change: `artifacts/api-server/src/routes/geo-aeo.ts`, `artifacts/api-server/src/routes/geo-aeo.test.ts`, `artifacts/api-server/src/lib/geo-aeo-service.test.ts`, `lib/api-spec/openapi.yaml`, generated API client/Zod files, dependency manifests/lockfile, and this status document.
- Tests/checks to run: focused GEO/AEO Vitest suites, full `pnpm run test`, `typecheck`, `lint`, `build`, `security:check`, and `api:route-drift:check`.
- Rollback plan: remove the approve alias/tests/OpenAPI additions and dependency version bumps; the pre-existing PATCH approval path and core GEO/AEO API remain usable.

## Checkpoint - 2026-06-24 Manual Fallback Extension

- Current task: add operator-managed manual fallback API surfaces that let an audit progress without real answer-engine integrations.
- Acceptance criteria targeted: operators can manually update answer snapshot mention/citation/risk flags, manage competitors, add/delete citations/source URLs, create/update source recommendations, and create/update schema findings; client-role users remain blocked from these operator-only mutations; all routes are tenant-scoped and audited.
- Files expected to change: shared GEO/AEO schemas/constants, `geo-aeo-service.ts`, `geo-aeo.ts` routes, route tests, OpenAPI spec, generated API clients, and implementation status.
- Tests/checks to run: focused GEO/AEO tests, full `test`, `typecheck`, `lint`, `build`, `security:check`, `api:route-drift:check`, and API spec codegen.
- Rollback plan: remove the new manual fallback route block/service methods/OpenAPI paths while leaving the existing audit/prompt/snapshot/analyze/report flow intact.

## Checkpoint - 2026-06-24 Monthly Monitoring Scaffold

- Current task: add the G16 manual monthly monitoring scaffold without enabling automated real-engine runs.
- Acceptance criteria targeted: audits can store monitoring cadence metadata; operators can manually create/list/update/approve monthly monitoring runs; month-over-month score delta and snapshot-count comparison fields are stored; client-role users can read only approved monitoring progress for approved audits; OpenAPI/generated clients include monitoring operations.
- Files expected to change: GEO/AEO DB schema/migrations, shared GEO/AEO schemas/constants, `geo-aeo-service.ts`, `geo-aeo.ts` routes, route/service tests, OpenAPI spec, generated API client/Zod files, and this status document.
- Tests/checks to run: focused GEO/AEO Vitest suites, `db:generate`, `api:route-drift:check`, API spec codegen, full `typecheck`, `lint`, `test`, `build`, and `security:check`.
- Rollback plan: remove the monitoring-run table/cadence fields, monitoring route/service blocks, shared schemas/events, OpenAPI paths/schemas, generated client changes, and monitoring tests while leaving the existing one-time audit workflow intact.

## Checkpoint - 2026-06-24 Frontend Manual Workflow Extension

- Current task: expose the primary operator manual fallback and monitoring workflow controls on the RankMap GEO/AEO Visibility page.
- Acceptance criteria targeted: operators can mark answer snapshots as mentioned/cited, add competitors, add/delete citations, add source recommendations, add schema findings, create/approve monitoring runs, and see client-approved monitoring progress through the existing client detail payload; client-role users continue to see only approved read surfaces.
- Files expected to change: `artifacts/rankmap/src/pages/geo-aeo.tsx` and this status document.
- Tests/checks to run: RankMap typecheck, full workspace typecheck, lint, and build.
- Rollback plan: remove the new page panels, local state, queries, and mutations while leaving the existing GEO/AEO audit list, CSV imports, findings, action plan, and report sections intact.

## Checkpoint - 2026-06-24 PDF Report Export

- Current task: add GEO/AEO PDF report generation/export because the existing app already supports `pdf` as a report format.
- Acceptance criteria targeted: GEO/AEO report generate/export schemas accept `pdf`; stored GEO/AEO reports can export as `application/pdf` with a `.pdf` filename; OpenAPI/generated clients include `pdf`; the RankMap GEO/AEO page can generate PDF reports and downloads reports using their stored format.
- Files expected to change: shared GEO/AEO schemas, `geo-aeo-service.ts`, service tests, OpenAPI spec, generated API client/Zod files, `artifacts/rankmap/src/pages/geo-aeo.tsx`, and this status document.
- Tests/checks to run: focused GEO/AEO service test, route drift check, API spec codegen, full `typecheck`, `lint`, `test`, `build`, and `security:check`.
- Rollback plan: remove `pdf` from GEO/AEO schemas/OpenAPI, remove the PDF serializer/export branch and PDF UI button, regenerate clients, and leave Markdown/CSV/JSON export intact.

## Checkpoint - 2026-06-24 Browser E2E Coverage

- Current task: add a protected browser e2e path for the GEO/AEO manual fallback workflow.
- Acceptance criteria targeted: Playwright covers an authenticated operator creating a client/project-linked GEO/AEO audit, importing prompts and snapshots, manually marking snapshot mention/citation flags, adding competitor/citation/source/schema fallback records, running analysis/action-plan generation, approving a monitoring run, generating a PDF report, and approving the audit.
- Files expected to change: `artifacts/rankmap/e2e/workspace.spec.ts`, `artifacts/rankmap/src/pages/geo-aeo.tsx`, `scripts/run-browser-e2e.mjs`, and this status document.
- Tests/checks to run: RankMap frontend typecheck, lint, browser e2e wrapper, full workspace typecheck, and full Vitest suite.
- Rollback plan: remove the GEO/AEO-specific Playwright test and test IDs while leaving API e2e, route tests, and the operator UI intact.

## Checkpoint - 2026-06-24 Operator Edit and Override UI

- Current task: expose existing manual record update and score override capabilities in the GEO/AEO operator workspace.
- Acceptance criteria targeted: operators can manually override the AI Visibility Score with a required reason, edit competitor records, edit source recommendations, edit schema findings, and prove those controls through the authenticated GEO/AEO browser workflow.
- Files expected to change: `artifacts/rankmap/src/pages/geo-aeo.tsx`, `artifacts/rankmap/e2e/workspace.spec.ts`, and this status document.
- Tests/checks to run: RankMap frontend typecheck, lint, browser e2e wrapper, full workspace typecheck, full Vitest suite, and build.
- Rollback plan: remove the score override panel, inline manual-record edit controls, and corresponding Playwright assertions while leaving the API-backed manual fallback workflow intact.

## Checkpoint - 2026-06-24 Manual Action Item Editing

- Current task: let operators manually create and edit action-plan items from the GEO/AEO workspace.
- Acceptance criteria targeted: operators can create a manual action item into the active action plan, a default manual plan is created when needed, client-role users cannot create action items, action item creation is audited, OpenAPI/generated clients include the route, and the protected browser workflow proves manual add/edit behavior.
- Files expected to change: shared GEO/AEO schemas/constants, `geo-aeo-service.ts`, `geo-aeo.ts` routes, route/service tests, OpenAPI spec and generated clients, `artifacts/rankmap/src/pages/geo-aeo.tsx`, `artifacts/rankmap/e2e/workspace.spec.ts`, and this status document.
- Tests/checks to run: focused GEO/AEO tests, route drift, API spec codegen, API/frontend typecheck, lint, browser e2e wrapper, full workspace tests, security gate, and build.
- Rollback plan: remove the action-item create schema/service/route/OpenAPI path/generated clients and the action-plan add/edit UI while leaving generated action plans and action item status updates intact.

## Checkpoint - 2026-06-24 Manual Record Delete Controls

- Current task: close the remaining delete/soft-delete gap for operator-managed manual fallback records.
- Acceptance criteria targeted: operators can soft-delete competitors, source recommendations, schema findings, and action items; client-role users remain blocked; delete actions are audited; OpenAPI/generated clients include the DELETE operations; the protected browser workflow proves add/edit/delete behavior for the affected records.
- Files expected to change: shared GEO/AEO constants, `geo-aeo-service.ts`, `geo-aeo.ts` routes, route/service tests, OpenAPI spec and generated clients, `artifacts/rankmap/src/pages/geo-aeo.tsx`, `artifacts/rankmap/e2e/workspace.spec.ts`, and this status document.
- Tests/checks to run: focused GEO/AEO tests, route drift, API spec codegen, API/frontend typecheck, lint, browser e2e wrapper, full workspace tests, security gate, and build.
- Rollback plan: remove the new soft-delete service helpers/routes/OpenAPI operations/generated clients and the UI trash controls while leaving add/edit/approve flows intact.

## Phase Checklist

- [x] G0 discovery completed.
- [x] Canonical GEO/AEO docs created.
- [x] G1 env placeholders added.
- [x] G1 env validation foundation added.
- [x] G2 shared constants/schemas/scoring added.
- [x] G3 database migration generated.
- [x] G4 RBAC/audit helpers added.
- [x] G5 audit CRUD API added.
- [x] G5 prompt/snapshot API routes added.
- [x] G5 analysis/score/finding API routes added.
- [x] G6 prompt/snapshot workflow added.
- [x] G7 answer-engine adapter registry added.
- [x] G8 AI task registry added.
- [x] G9 deterministic findings/score/action plans added.
- [x] G10 UI/reports/client dashboard added.
- [x] G11 hardening/route parity added.
- [x] G16 monthly monitoring scaffold added.
- [x] Primary manual fallback and monitoring controls exposed in the GEO/AEO page.
- [x] PDF report generation/export added for GEO/AEO reports.
- [x] Operator score override and manual-record edit controls exposed in the GEO/AEO page.
- [x] Manual action item creation/editing exposed in the GEO/AEO page.
- [x] Manual competitor/source/schema/action item soft-delete exposed in the GEO/AEO page.
- [ ] G17 final security hardening and smoke in progress.

## Tests/Checks Run

| Command | Result | Notes |
|---|---|---|
| `corepack pnpm install` | Pass | Linked the new `@workspace/shared` workspace package. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | 8 GEO/AEO shared tests passed. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed. |
| `corepack pnpm run deploy:preflight` | Pass | Dry run only: migrations, live services, and deployed health check skipped; GEO/AEO env guardrails accepted manual/mock config. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings. |
| `corepack pnpm --filter @workspace/db exec tsc -p tsconfig.json --noEmit` | Pass | GEO/AEO Drizzle schema typechecked before migration generation. |
| `corepack pnpm run db:generate` | Pass | Generated additive migration `lib/db/drizzle/0001_yielding_the_fallen.sql`. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | Re-ran after G3; 8 tests passed. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after schema and migration generation. |
| `corepack pnpm run lint` | Pass | ESLint passed after schema and migration generation. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | GEO/AEO access helper typechecked. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | Re-ran after G4; 8 tests passed. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after G4. |
| `corepack pnpm run lint` | Pass | ESLint passed after G4. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | GEO/AEO audit service and routes typechecked. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | Re-ran after audit route schemas; 8 tests passed. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after audit routes. |
| `corepack pnpm run lint` | Pass | ESLint passed after audit routes. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | Prompt/snapshot service and routes typechecked. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | 9 shared GEO/AEO tests passed after CSV parser coverage. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after prompt/snapshot routes. |
| `corepack pnpm run lint` | Pass | ESLint passed after prompt/snapshot routes. |
| `corepack pnpm run db:generate` | Pass | Regenerated migration after adding stored `services_or_products` audit data. |
| `corepack pnpm run typecheck:libs` | Pass | Rebuilt lib declarations after migration/schema correction. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | API server typecheck passed after audit data-model correction. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after audit data-model correction. |
| `corepack pnpm run lint` | Pass | ESLint passed after audit data-model correction. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | 13 shared tests passed after adapter registry addition. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed after adapter registry addition. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after adapter registry addition. |
| `corepack pnpm run lint` | Pass | ESLint passed after adapter registry addition. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | Analysis, score, and finding route/service logic typechecked. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | 13 shared tests passed after score input schema changes. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed after score input schema changes. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after analysis/score/finding routes. |
| `corepack pnpm run lint` | Pass | ESLint passed after analysis/score/finding routes. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | Action-plan route/service logic typechecked. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed after action-plan schema addition. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | 13 shared tests passed after action-plan schema addition. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after action-plan routes. |
| `corepack pnpm run lint` | Pass | ESLint passed after action-plan routes. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo` | Pass | 16 shared GEO/AEO tests passed after AI task registry, report/export schemas, and adapter coverage. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed after report/export schema additions. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | API server typecheck passed after report/export and client-dashboard endpoints. |
| `corepack pnpm --filter rankmap exec tsc -p tsconfig.json --noEmit` | Pass | RankMap frontend typecheck passed after the GEO/AEO page and navigation were added. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after the GEO/AEO UI/client-dashboard increment. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after the GEO/AEO UI/client-dashboard increment. |
| `corepack pnpm --filter @workspace/rankmap run build` | Pass | Vite production build passed after the GEO/AEO page was added. |
| `corepack pnpm --filter @workspace/api-server run build` | Pass | API server production bundle built after the GEO/AEO route/service additions. |
| Playwright navigation to `http://localhost:5173/geo-aeo` | Partial | Frontend served and redirected unauthenticated users to `/login`; protected page smoke was blocked because the existing `localhost:8080` listener returned 404 for RankMap API routes and no local `DATABASE_URL` is configured in this shell. |
| `corepack pnpm exec vitest run artifacts/api-server/src/routes/geo-aeo.test.ts artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | 6 API hardening tests passed for client visibility, mutation/export denial, approval endpoint RBAC, approval metadata, and CSV formula neutralization. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo artifacts/api-server/src/routes/geo-aeo.test.ts artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | 22 focused GEO/AEO tests passed across shared domain logic, adapters, AI tasks, routes, and service hardening. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift is zero undocumented and zero stale after documenting GEO/AEO routes. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated `lib/api-client-react` and `lib/api-zod` with GEO/AEO operations and schemas. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed: 73 passed, 4 e2e tests skipped by existing repo gates. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after OpenAPI/codegen and security dependency upgrades. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after hardening additions. |
| `corepack pnpm run build` | Pass | Full workspace build passed after hardening additions and Vite 7.3.5 upgrade. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed after upgrading Vitest/Vite/Nodemailer; remaining audit items are below the configured high-severity gate. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo artifacts/api-server/src/routes/geo-aeo.test.ts artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | 23 focused GEO/AEO tests passed after adding manual fallback routes and citation RBAC/audit coverage. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after documenting manual fallback routes. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after manual fallback route additions. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after manual fallback additions: 74 passed, 4 e2e tests skipped by existing repo gates. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after manual fallback additions. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after manual fallback additions. |
| `corepack pnpm run build` | Pass | Full workspace build passed after manual fallback additions. |
| `corepack pnpm run security:check` | Pass | Secret scan and high-severity audit gate passed after manual fallback additions. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo artifacts/api-server/src/routes/geo-aeo.test.ts artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | 27 focused GEO/AEO tests passed after adding monitoring cadence/run schemas, RBAC route coverage, and score-delta service coverage. |
| `corepack pnpm run db:generate` | Pass | Generated additive monitoring migration `lib/db/drizzle/0002_groovy_inertia.sql`. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after documenting monitoring routes. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after monitoring route additions; library typecheck passed during codegen. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after monitoring additions. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after monitoring additions. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after monitoring additions: 78 passed, 4 e2e tests skipped by existing repo gates. |
| `corepack pnpm run build` | Pass | Full workspace build passed after monitoring additions. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are low/moderate and below the configured high-severity gate. |
| `corepack pnpm --filter @workspace/rankmap exec tsc -p tsconfig.json --noEmit` | Pass | RankMap frontend typecheck passed after adding manual fallback and monitoring controls to the GEO/AEO page. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after adding frontend manual fallback and monitoring controls. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding frontend manual fallback and monitoring controls. |
| `corepack pnpm --filter @workspace/rankmap run build` | Pass | RankMap production build passed after adding frontend manual fallback and monitoring controls. |
| `corepack pnpm exec vitest run artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | GEO/AEO service tests passed after adding PDF report export coverage. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after adding GEO/AEO PDF report support. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after adding PDF report export content and format enums. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after adding GEO/AEO PDF format support. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after adding GEO/AEO PDF support: 79 passed, 4 e2e tests skipped by existing repo gates. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed after adding PDF support; remaining audit items are low/moderate and below the configured high-severity gate. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after replacing the PDF sanitizer control-character regex with a char-code filter. |
| `corepack pnpm exec vitest run artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | Focused GEO/AEO service tests passed after the PDF sanitizer lint fix. |
| `corepack pnpm run build` | Pass | Full workspace build passed after adding GEO/AEO PDF support and the PDF sanitizer lint fix. |
| `corepack pnpm run test:e2e:api` | Pass | API e2e wrapper created a temporary Postgres database, applied migrations, and passed the expanded workflow including GEO/AEO audit creation, prompt/snapshot/manual fallback records, analysis, action plan, monitoring approval, PDF report export, audit approval, and approved client progress reads. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after adding the GEO/AEO API e2e path. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding the GEO/AEO API e2e path. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after adding the GEO/AEO API e2e path: 79 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm --filter @workspace/rankmap exec tsc -p tsconfig.json --noEmit` | Pass | RankMap frontend typecheck passed after adding stable GEO/AEO browser-test hooks. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding the GEO/AEO protected browser journey. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper created a temporary Postgres database, applied migrations, started API/frontend servers, and passed both the existing general workspace smoke and the GEO/AEO manual fallback Playwright workflow. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after the GEO/AEO protected browser journey. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after the GEO/AEO protected browser journey: 79 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run build` | Pass | Full workspace build passed after the GEO/AEO protected browser journey and test hooks. |
| `corepack pnpm --filter @workspace/rankmap exec tsc -p tsconfig.json --noEmit` | Pass | RankMap frontend typecheck passed after adding score override and inline manual-record edit controls. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding score override and inline manual-record edit controls. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper passed after extending the GEO/AEO workflow to edit competitor/source/schema records and save a reasoned score override. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after the operator edit/override UI: 79 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are 2 low and 3 moderate below the configured high-severity gate. |
| `corepack pnpm run build` | Pass | Full workspace build passed after the operator edit/override UI. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed after adding the action item create schema. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | API server typecheck passed after adding manual action item creation. |
| `corepack pnpm --filter @workspace/rankmap exec tsc -p tsconfig.json --noEmit` | Pass | RankMap frontend typecheck passed after adding action-plan add/edit controls. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after documenting `POST /geo-aeo/audits/{auditId}/action-items`. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after adding manual action item creation. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo artifacts/api-server/src/routes/geo-aeo.test.ts artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | 30 focused GEO/AEO tests passed after adding action item creation service/route coverage. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding action-plan add/edit controls. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper passed after extending the protected GEO/AEO workflow to add and edit a manual action item. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after manual action item creation/editing: 81 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are 2 low and 3 moderate below the configured high-severity gate. |
| `corepack pnpm run build` | Pass | Full workspace build passed after manual action item creation/editing. |
| `corepack pnpm --filter @workspace/shared exec tsc -p tsconfig.json --noEmit` | Pass | Shared package typecheck passed after adding manual delete event constants. |
| `corepack pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` | Pass | API server typecheck passed after adding manual soft-delete routes. |
| `corepack pnpm --filter @workspace/rankmap exec tsc -p tsconfig.json --noEmit` | Pass | RankMap frontend typecheck passed after adding delete controls. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after documenting manual delete routes. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after adding manual delete routes. |
| `corepack pnpm exec vitest run lib/shared/src/geo-aeo artifacts/api-server/src/routes/geo-aeo.test.ts artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | 32 focused GEO/AEO tests passed after adding manual soft-delete service/route coverage. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding delete controls. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper passed after extending the protected GEO/AEO workflow to add, edit, and delete manual records/action items. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after manual delete controls: 83 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are 2 low and 3 moderate below the configured high-severity gate. |
| `corepack pnpm run build` | Pass | Full workspace build passed after manual delete controls. |

## Known Limitations

- Database schema and migration are present, but migrations were not applied to a live database in this turn.
- Audit, prompt, snapshot, analysis, score, finding, action-plan, report/export, and approved-only client-dashboard API routes are present.
- Manual fallback API routes are present for snapshot marking, competitors, citations/source URLs, source recommendations, and schema findings.
- Monthly monitoring scaffold is present for audit cadence metadata, manual monitoring runs, score deltas, snapshot-count comparisons, approval, and approved-only client progress reads.
- The RankMap frontend has a GEO/AEO Visibility page for operator workflows, primary manual fallback controls, monitoring run controls, and client-role approved audit views.
- GEO/AEO report generation currently requires a linked project because the existing shared `reports` table requires `projectId`.
- GEO/AEO report export supports markdown, CSV, JSON, and PDF.
- The frontend surface exposes primary manual fallback controls, monitoring creation/approval, score override, action item creation/editing, edit-in-place for competitors/source recommendations/schema findings, and soft-delete controls for manual competitors/source recommendations/schema findings/action items.
- Client-role GEO/AEO views are tenant-scoped and approved-only, but the current user schema has no per-client contact assignment model, so row-level client-contact scoping would require a future data-model addition.
- OpenAPI and generated client/Zod packages now include GEO/AEO routes; the first frontend surface still uses `customFetch` directly.
- Repo API and browser e2e wrappers now pass against temporary Postgres databases, including an authenticated GEO/AEO protected browser journey for the manual fallback workflow.
- RTK was not available on PATH in the 2026-06-24 resumed environment, so verification commands in that resumed block ran through plain `corepack pnpm`.
- The existing repo has substantial pre-existing uncommitted changes; this feature block must avoid reverting them.
- GEO/AEO is not production-ready and does not change the Phase 39 launch no-go status.
