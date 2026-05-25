# Performance Baseline

This document records the local Phase 38 baseline for core API paths, queue/backlog behavior, and page-load behavior. The API baseline is intentionally repeatable: `pnpm run perf:baseline` starts a disposable PostgreSQL database, applies migrations, starts the API server with a disposable `HEALTH_CHECK_TOKEN`, seeds a tenant/client/project with 100 keywords, seeds a 500-task AI backlog, measures core endpoints, verifies report generation and export paths, checks selected concurrent read/export/backlog paths, checks authenticated degraded health scenarios, and removes the test containers/processes afterward.

The page-load baseline is also repeatable: `pnpm run perf:pages` starts a disposable PostgreSQL database, builds the API, builds the production frontend bundle, serves that built frontend through a same-origin local harness, seeds an authenticated workspace, and measures key screens in Chromium.

The backup/restore baseline is repeatable through `pnpm run recovery:baseline`; it creates a custom-format PostgreSQL dump from a seeded disposable source database, restores into a fresh disposable database, and compares source/restored counts plus checksums.

The tenant-size baseline is repeatable through `pnpm run perf:tenant-size`; it seeds a larger single tenant and measures the dashboard, list, export, and backlog endpoints against the larger dataset.

The slow-provider baseline is repeatable through `pnpm run perf:slow-provider`; it runs the API against a deliberately delayed OpenAI-compatible endpoint and verifies fast fallback behavior.

## Budgets

| Check | Budget |
|-------|--------|
| Keyword import seed | 100 keywords imported in <= 5000ms |
| `GET /api/healthz` | p95 <= 75ms |
| `GET /api/auth/me` | p95 <= 150ms |
| `GET /api/tenant/dashboard` | p95 <= 250ms |
| `GET /api/clients` | p95 <= 250ms |
| `GET /api/projects?clientId=:id` | p95 <= 250ms |
| `GET /api/projects/:id` | p95 <= 200ms |
| `GET /api/projects/:id/keywords` | p95 <= 300ms |
| `GET /api/projects/:id/briefs` | p95 <= 300ms |
| AI task backlog seed | 500 tasks inserted and verified in <= 5000ms |
| `GET /api/ai-tasks` with 500-task backlog | p95 <= 500ms and status counts match |
| `GET /api/ai-tasks/:id` | p95 <= 200ms and queued task detail is readable |
| `POST /api/projects/:id/reports`, 12 generated JSON reports | p95 <= 350ms |
| `GET /api/projects/:id/export/keywords.csv` | p95 <= 400ms and seeded keyword data present |
| `GET /api/projects/:id/export/project.json` | p95 <= 500ms and seeded keywords/reports present |
| `GET /api/healthz`, 60 requests at concurrency 10 | p95 <= 150ms, 0 failures |
| `GET /api/tenant/dashboard`, 50 requests at concurrency 10 | p95 <= 500ms, 0 failures |
| `GET /api/projects/:id/keywords`, 50 requests at concurrency 10 | p95 <= 600ms, 0 failures |
| `GET /api/projects/:id/export/project.json`, 30 requests at concurrency 5 | p95 <= 900ms, 0 failures |
| `GET /api/ai-tasks`, 30 requests at concurrency 5 | p95 <= 900ms, 0 failures |
| Degraded billing health check | `GET /api/healthz/detailed` returns 503 with database ok and billing `missing-config` |
| Database outage health check | Stopping the disposable database makes `GET /api/healthz/detailed` return 503 with database `error` |

## Tenant-Size Budgets

| Check | Budget |
|-------|--------|
| Large tenant seed | 25 clients, 100 projects, 9950 keywords, 1000 AI tasks, and 20 reports in <= 15000ms |
| `GET /api/tenant/dashboard` | p95 <= 800ms with large tenant counts verified |
| `GET /api/clients` | p95 <= 500ms with 25 clients |
| `GET /api/projects?clientId=:id` | p95 <= 500ms with 4 projects for the target client |
| `GET /api/projects/:id/keywords` | p95 <= 1500ms with 5000 target-project keywords |
| `GET /api/projects/:id/export/keywords.csv` | p95 <= 2500ms with 5000 target-project keywords |
| `GET /api/projects/:id/export/project.json` | p95 <= 3000ms with 5000 target-project keywords and 20 reports |
| `GET /api/ai-tasks` | p95 <= 1500ms with 1000 AI tasks |

## Slow-Provider Budgets

| Check | Budget |
|-------|--------|
| Slow OpenAI-compatible endpoint | Delays for 1500ms |
| API provider timeout | Configurable through `OPENAI_TIMEOUT_MS`; test uses 200ms |
| Auto-clustering fallback | Completes in <= 2500ms and creates mock clusters |
| AI task metadata | Records that OpenAI was attempted before fallback |

## Recovery Budgets

| Check | Budget |
|-------|--------|
| PostgreSQL dump | Completes successfully |
| PostgreSQL restore | Completes successfully into a clean database |
| Restored fingerprint | Source and restored counts/checksums match |

## Page-Load Budgets

| Check | Budget |
|-------|--------|
| Production frontend build | Build completes before page-load checks run |
| Login page | Visible in <= 1800ms |
| Dashboard | Visible in <= 2500ms |
| Clients | Visible in <= 2500ms |
| Client detail | Visible in <= 2500ms |
| Project detail with 100 keywords | Visible in <= 3000ms |
| Analytics | Visible in <= 3000ms |
| Billing | Visible in <= 2500ms |
| Settings | Visible in <= 2500ms |
| Mobile dashboard at 390px width | Visible in <= 3000ms |
| Browser runtime errors | 0 page errors or console errors during measured authenticated pages |

## Latest Local Baseline

Recorded: 2026-05-18

| Check | Result |
|-------|--------|
| Keyword import seed | 100 keywords in 68ms |
| AI task backlog seed | 500 tasks in 364ms; 350 queued, 100 running, 50 completed |
| `GET /api/healthz` | p50 6ms, p95 9ms, max 13ms |
| `GET /api/auth/me` | p50 15ms, p95 18ms, max 21ms |
| `GET /api/tenant/dashboard` | p50 26ms, p95 65ms, max 130ms |
| `GET /api/clients` | p50 11ms, p95 30ms, max 36ms |
| `GET /api/projects?clientId=:id` | p50 11ms, p95 17ms, max 41ms |
| `GET /api/projects/:id` | p50 7ms, p95 10ms, max 11ms |
| `GET /api/projects/:id/keywords` | p50 12ms, p95 16ms, max 20ms |
| `GET /api/projects/:id/briefs` | p50 8ms, p95 11ms, max 11ms |
| `GET /api/ai-tasks` with 500-task backlog | p50 19ms, p95 33ms, max 33ms |
| `GET /api/ai-tasks/:id` | p50 6ms, p95 8ms, max 8ms |
| `POST /api/projects/:id/reports` | p50 28ms, p95 84ms, max 84ms |
| `GET /api/projects/:id/export/keywords.csv` | p50 8ms, p95 12ms, max 12ms |
| `GET /api/projects/:id/export/project.json` | p50 11ms, p95 20ms, max 20ms |
| `GET /api/healthz`, concurrency 10 | p50 5ms, p95 21ms, max 65ms, 0 failures |
| `GET /api/tenant/dashboard`, concurrency 10 | p50 40ms, p95 48ms, max 50ms, 0 failures |
| `GET /api/projects/:id/keywords`, concurrency 10 | p50 41ms, p95 54ms, max 57ms, 0 failures |
| `GET /api/projects/:id/export/project.json`, concurrency 5 | p50 34ms, p95 43ms, max 43ms, 0 failures |
| `GET /api/ai-tasks`, concurrency 5 | p50 45ms, p95 77ms, max 82ms, 0 failures |
| Degraded billing health check | 503 in 10ms; database ok, billing missing config |
| Database outage health check | 503 in 10ms; database error |

## Latest Tenant-Size Baseline

Recorded: 2026-05-19

| Check | Result |
|-------|--------|
| Large tenant seed | 25 clients, 100 projects, 9950 keywords, 1000 AI tasks, and 20 reports in 3368ms |
| `GET /api/tenant/dashboard` | p50 47ms, p95 225ms, max 225ms |
| `GET /api/clients` | p50 27ms, p95 81ms, max 81ms |
| `GET /api/projects?clientId=:id` | p50 23ms, p95 62ms, max 62ms |
| `GET /api/projects/:id/keywords` | p50 208ms, p95 507ms, max 507ms |
| `GET /api/projects/:id/export/keywords.csv` | p50 188ms, p95 251ms, max 251ms |
| `GET /api/projects/:id/export/project.json` | p50 285ms, p95 378ms, max 378ms |
| `GET /api/ai-tasks` | p50 60ms, p95 104ms, max 104ms |

## Latest Slow-Provider Baseline

Recorded: 2026-05-20

| Check | Result |
|-------|--------|
| Slow OpenAI-compatible endpoint | Delayed for 1500ms |
| API provider timeout | 200ms |
| Auto-clustering fallback | Completed in 257ms |
| Mock clusters created | 1 |
| AI task metadata | Recorded attempted provider as `openai` |

## Latest Page-Load Baseline

Recorded: 2026-05-16

| Check | Result |
|-------|--------|
| Production frontend build | Passed; generated split chunks for React, Radix UI, TanStack, icons, UI utilities, CSS, and app code |
| Login page | 1076ms |
| Dashboard | 698ms |
| Clients | 631ms |
| Client detail | 646ms |
| Project detail with 100 keywords | 681ms |
| Analytics | 671ms |
| Billing | 661ms |
| Settings | 734ms |
| Mobile dashboard at 390px width | 618ms |
| Browser runtime errors | 0 |

## Latest Recovery Baseline

Recorded: 2026-05-18

| Check | Result |
|-------|--------|
| PostgreSQL dump | 803ms |
| PostgreSQL restore | 2876ms |
| Restored tenants | 1 |
| Restored users | 2 |
| Restored clients | 1 |
| Restored projects | 1 |
| Restored keywords | 120 |
| Restored AI tasks | 60 |
| Restored reports | 2 |
| Fingerprint comparison | Source and restored counts/checksums matched |

## Notes

- This is a local baseline, not a hosted staging or production load test.
- The current runner measures local sequential request latency plus small concurrent read/export/backlog baselines. It is a release guard for obvious regressions, not a substitute for hosted load testing.
- The tenant-size runner measures a larger local tenant with 25 clients, 100 projects, 9950 keywords, 1000 AI tasks, and 20 reports. It is a dataset-size guard, not a hosted load or multi-tenant capacity test.
- The slow-provider runner proves AI clustering falls back quickly when an OpenAI-compatible provider is slower than the configured timeout.
- The page-load runner measures a production frontend build served by a local same-origin harness. It catches blank screens, slow first-visible screen loads, and browser runtime errors on key authenticated pages.
- The recovery runner proves logical PostgreSQL backup/restore in a non-production environment. Production still needs managed backup policy, retention, access controls, and point-in-time recovery configuration.
- The degraded health checks cover missing billing configuration and database outage behavior.
- Phase 38 local baseline coverage now includes the currently planned API, page-load, queue, recovery, tenant-size, and slow-provider proof points. Hosted staging load tests and real provider credentials remain separate launch-readiness work.
