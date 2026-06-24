# GEO/AEO Implementation Status

## Current GEO/AEO Phase

G17 - Final Hardening and Smoke

## Current Task

Continue final hardening after adding route tests, service hardening tests, OpenAPI/codegen coverage, route-drift parity, dependency security upgrades, manual fallback API surfaces, the monthly monitoring scaffold, protected browser coverage, and operator import-preview safeguards.

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

## Checkpoint - 2026-06-24 Import Preview and Duplicate Detection

- Current task: close the prompt/snapshot CSV preview gap called out in G6/G7 without enabling real answer-engine integrations.
- Acceptance criteria targeted: operators can preview prompt and snapshot CSV files before import; preview responses show total, valid, invalid, and duplicate row counts plus row-level issue details; duplicate prompt text and duplicate snapshot prompt/engine/answer-hash rows are rejected before import; snapshot previews validate prompt IDs against the tenant-scoped audit; client-role users remain blocked; OpenAPI/generated clients include the preview operations; the protected browser workflow proves preview-before-import behavior.
- Files expected to change: `geo-aeo-service.ts`, `geo-aeo.ts` routes, route/service tests, OpenAPI spec and generated clients, `artifacts/rankmap/src/pages/geo-aeo.tsx`, `artifacts/rankmap/e2e/workspace.spec.ts`, and this status document.
- Tests/checks to run: focused GEO/AEO tests, route drift, API spec codegen, API/frontend typecheck, lint, browser e2e wrapper, full workspace tests, security gate, and build.
- Rollback plan: remove the preview service helpers/routes/OpenAPI operations/generated clients and the UI preview controls while leaving the existing all-or-nothing CSV imports intact.

## Checkpoint - 2026-06-24 Snapshot Import Rollback

- Current task: close the G7 snapshot CSV rollback/delete import gap with a durable import batch model.
- Acceptance criteria targeted: snapshot CSV imports create tenant-scoped import batch records; imported snapshot rows store `importBatchId`; operators can list active snapshot import batches and roll one back; rollback soft-deletes imported snapshots plus snapshot-linked citations and mentions; client-role users remain blocked; rollback actions are audited; OpenAPI/generated clients include list/delete batch operations; the protected browser workflow shows rollback controls after snapshot import.
- Files expected to change: GEO/AEO DB schema/migration, shared GEO/AEO constants, `geo-aeo-service.ts`, `geo-aeo.ts` routes, route/service tests, OpenAPI spec and generated clients, `artifacts/rankmap/src/pages/geo-aeo.tsx`, `artifacts/rankmap/e2e/workspace.spec.ts`, and this status document.
- Tests/checks to run: `db:generate`, focused GEO/AEO route/service tests, route drift, API spec codegen, DB/API/frontend typecheck, lint, browser e2e wrapper, full workspace tests, security gate, and build.
- Rollback plan: remove the import-batch table/columns/migration, batch service helpers/routes/OpenAPI operations/generated clients, and UI rollback controls while returning snapshot CSV imports to direct bulk insert behavior.

## Checkpoint - 2026-06-24 Client Dashboard License Gate

- Current task: close the G15 server-side license enforcement gap for client-facing GEO/AEO dashboard views and downloads.
- Acceptance criteria targeted: client-role users require `geoAeo.viewClientDashboard` plus an agency/enterprise AI visibility license before approved dashboard data is returned; operator roles can still inspect approved client views; client detail responses expose download availability; disallowed clients see a permission-denied state instead of an empty dashboard.
- Files expected to change: `geo-aeo-access.ts`, `geo-aeo.ts` routes, access/route tests, OpenAPI spec and generated clients, `artifacts/rankmap/src/pages/geo-aeo.tsx`, and this status document.
- Tests/checks to run: focused GEO/AEO access/route tests, route drift, API spec codegen, API/frontend typecheck, lint, full workspace tests, security gate, browser/API e2e wrappers, and build.
- Rollback plan: remove the client dashboard authorization helper and route checks, remove the access metadata from the client detail payload/OpenAPI/generated clients, and return the frontend to its prior client-report rendering.

## Checkpoint - 2026-06-24 Report Required Sections

- Current task: close the G14 report completeness gap for prompt matrix and methodology/limitations sections.
- Acceptance criteria targeted: newly generated GEO/AEO reports store prompt and answer-snapshot evidence; Markdown/PDF exports include a prompt matrix, snapshot evidence, scorecard, findings, action plan, and methodology/limitations; CSV exports include prompt matrix and answer snapshot rows while continuing to neutralize spreadsheet-leading formula cells.
- Files expected to change: `geo-aeo-service.ts`, service tests, and this status document.
- Tests/checks to run: focused GEO/AEO service tests, full workspace tests, typecheck, lint, API e2e, browser e2e, security gate, and build.
- Rollback plan: remove prompt/snapshot/methodology fields from generated report data and remove the new export rows/sections while leaving existing summary/finding/action-plan report export behavior intact.

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
- [x] Prompt/snapshot CSV import preview and duplicate gates added.
- [x] Snapshot CSV import batch rollback/delete controls added.
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
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after adding prompt and snapshot CSV import preview operations. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after documenting preview routes. |
| `corepack pnpm exec vitest run artifacts/api-server/src/lib/geo-aeo-service.test.ts artifacts/api-server/src/routes/geo-aeo.test.ts` | Pass | 21 focused GEO/AEO route/service tests passed after adding preview counts and duplicate import gates. |
| `corepack pnpm --filter @workspace/api-server run typecheck` | Pass | API server typecheck passed after adding preview service/route logic. |
| `corepack pnpm --filter @workspace/rankmap run typecheck` | Pass | RankMap frontend typecheck passed after adding preview controls and summaries. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding import preview controls. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after import preview and duplicate gates: 88 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper passed after extending the protected GEO/AEO workflow to preview prompt and snapshot CSV imports before writing. Initial run exposed a strict locator assertion conflict between toast/live-region text; rerun passed after targeting the preview summary panel. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are 2 low and 3 moderate below the configured high-severity gate. |
| `corepack pnpm run build` | Pass | Full workspace build passed after import preview and duplicate gates. |
| `corepack pnpm run test:e2e:api` | Pass | API e2e wrapper passed against a temporary Postgres database after the import preview increment. |
| `corepack pnpm run db:generate` | Pass | Generated additive migration `lib/db/drizzle/0003_worried_living_mummy.sql` for snapshot import batches, snapshot `import_batch_id`, and mention soft-delete support. |
| `corepack pnpm run typecheck:libs` | Pass | Rebuilt library declarations after adding the import-batch schema before API typecheck. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after adding snapshot import batch list/rollback operations. |
| `corepack pnpm exec vitest run artifacts/api-server/src/lib/geo-aeo-service.test.ts artifacts/api-server/src/routes/geo-aeo.test.ts` | Pass | 25 focused GEO/AEO route/service tests passed after adding snapshot import batch creation and rollback coverage. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after documenting snapshot import batch routes. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after snapshot import rollback changes. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding snapshot import rollback controls. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after snapshot import rollback: 92 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper passed after showing the rollback control on the protected GEO/AEO snapshot import workflow. |
| `corepack pnpm run test:e2e:api` | Pass | API e2e wrapper passed against a temporary Postgres database after the rollback migration and route changes. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are 2 low and 3 moderate below the configured high-severity gate. |
| `corepack pnpm run build` | Pass | Full workspace build passed after snapshot import rollback. |
| `corepack pnpm exec vitest run artifacts/api-server/src/lib/geo-aeo-access.test.ts artifacts/api-server/src/routes/geo-aeo.test.ts` | Pass | 22 focused GEO/AEO access/route tests passed after adding the client dashboard license gate. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after client dashboard license enforcement and access metadata updates. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after client dashboard license enforcement. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero after documenting client dashboard license-denied responses. |
| `corepack pnpm --filter @workspace/api-spec run codegen` | Pass | Regenerated API client/Zod packages after adding client dashboard access metadata. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after client dashboard license enforcement: 99 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run test:e2e:api` | Pass | API e2e wrapper passed against a temporary Postgres database after the client dashboard license gate. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper passed after the client dashboard license gate and download-visibility UI change. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are 2 low and 3 moderate below the configured high-severity gate. |
| `corepack pnpm run build` | Pass | Full workspace build passed after client dashboard license enforcement. |
| `corepack pnpm exec vitest run artifacts/api-server/src/lib/geo-aeo-service.test.ts` | Pass | GEO/AEO service tests passed after adding prompt matrix, answer snapshot evidence, and methodology/limitations to report exports. |
| `corepack pnpm run typecheck` | Pass | Full workspace typecheck passed after adding required report sections. |
| `corepack pnpm run lint` | Pass | ESLint completed with zero warnings after adding required report sections. |
| `corepack pnpm run test` | Pass | Full Vitest suite passed after report-section expansion: 99 passed, 4 e2e tests skipped by default gates. |
| `corepack pnpm run api:route-drift:check` | Pass | OpenAPI route drift stayed zero; report-section changes did not add or remove routes. |
| `corepack pnpm run security:check` | Pass | Secret scan passed and `pnpm audit --audit-level high` passed; remaining audit items are 2 low and 3 moderate below the configured high-severity gate. |
| `corepack pnpm run build` | Pass | Full workspace build passed after required report-section expansion. |
| `corepack pnpm run test:e2e:api` | Pass | API e2e wrapper passed sequentially after an earlier parallel API/browser e2e attempt hit a temporary Postgres startup collision. |
| `corepack pnpm run test:e2e:browser` | Pass | Browser e2e wrapper passed sequentially after the same temporary Postgres startup collision in the earlier parallel attempt. |

## Known Limitations

- Database schema and migration are present, but migrations were not applied to a live database in this turn.
- Audit, prompt, snapshot, analysis, score, finding, action-plan, report/export, and approved-only client-dashboard API routes are present.
- Manual fallback API routes are present for snapshot marking, competitors, citations/source URLs, source recommendations, and schema findings.
- Monthly monitoring scaffold is present for audit cadence metadata, manual monitoring runs, score deltas, snapshot-count comparisons, approval, and approved-only client progress reads.
- The RankMap frontend has a GEO/AEO Visibility page for operator workflows, primary manual fallback controls, monitoring run controls, and client-role approved audit views.
- GEO/AEO report generation currently requires a linked project because the existing shared `reports` table requires `projectId`.
- GEO/AEO report export supports markdown, CSV, JSON, and PDF.
- Newly generated GEO/AEO reports now include prompt matrix, answer snapshot evidence, AI visibility scorecard, and methodology/limitations sections across Markdown/PDF, with corresponding prompt matrix and snapshot rows in CSV.
- The frontend surface exposes primary manual fallback controls, monitoring creation/approval, score override, action item creation/editing, edit-in-place for competitors/source recommendations/schema findings, and soft-delete controls for manual competitors/source recommendations/schema findings/action items.
- Prompt and snapshot CSV imports now have operator-only preview endpoints/UI summaries with valid/invalid/duplicate row counts, and imports reject duplicate prompt text or duplicate prompt/engine/answer-hash snapshots before writing rows.
- Snapshot CSV imports now create rollbackable import batches; rollback applies to imports written through this batch model and does not retroactively group older snapshot rows that predate the batch migration.
- GEO/AEO report export now enforces the explicit `geoAeo.exportReports` gate before generating a download. Operators export by GEO/AEO operator role; client-role downloads additionally require an approved audit-backed report and an agency/enterprise tenant download license.
- Client-role GEO/AEO dashboard reads now enforce `geoAeo.viewClientDashboard` plus an agency/enterprise AI visibility license server-side; licensed client detail responses include `downloadsAllowed` so the UI can show report downloads only when allowed.
- Client-role GEO/AEO views are tenant-scoped and approved-only, but the current user schema has no per-client contact assignment model, so row-level client-contact scoping would require a future data-model addition.
- OpenAPI and generated client/Zod packages now include GEO/AEO routes; the first frontend surface still uses `customFetch` directly.
- Repo API and browser e2e wrappers now pass against temporary Postgres databases, including an authenticated GEO/AEO protected browser journey for the manual fallback workflow.
- RTK was not available on PATH in the 2026-06-24 resumed environment, so verification commands in that resumed block ran through plain `corepack pnpm`.
- The resumed 2026-06-24 rollback increment started from a clean worktree after commit `1907213`.
- GEO/AEO is not production-ready and does not change the Phase 39 launch no-go status.
