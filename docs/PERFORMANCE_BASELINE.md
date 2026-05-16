# Performance Baseline

This document records the local Phase 38 baseline for core API paths and page-load behavior. The API baseline is intentionally repeatable: `pnpm run perf:baseline` starts a disposable PostgreSQL database, applies migrations, starts the API server, seeds a tenant/client/project with 100 keywords, measures core endpoints, verifies report generation and export paths, checks selected concurrent read/export paths, checks degraded health scenarios, and removes the test containers/processes afterward.

The page-load baseline is also repeatable: `pnpm run perf:pages` starts a disposable PostgreSQL database, builds the API, builds the production frontend bundle, serves that built frontend through a same-origin local harness, seeds an authenticated workspace, and measures key screens in Chromium.

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
| `POST /api/projects/:id/reports`, 12 generated JSON reports | p95 <= 350ms |
| `GET /api/projects/:id/export/keywords.csv` | p95 <= 400ms and seeded keyword data present |
| `GET /api/projects/:id/export/project.json` | p95 <= 500ms and seeded keywords/reports present |
| `GET /api/healthz`, 80 requests at concurrency 10 | p95 <= 150ms, 0 failures |
| `GET /api/tenant/dashboard`, 60 requests at concurrency 10 | p95 <= 500ms, 0 failures |
| `GET /api/projects/:id/keywords`, 60 requests at concurrency 10 | p95 <= 600ms, 0 failures |
| `GET /api/projects/:id/export/project.json`, 30 requests at concurrency 5 | p95 <= 900ms, 0 failures |
| Degraded billing health check | `GET /api/healthz/detailed` returns 503 with database ok and billing `missing-config` |
| Database outage health check | Stopping the disposable database makes `GET /api/healthz/detailed` return 503 with database `error` |

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

Recorded: 2026-05-15

| Check | Result |
|-------|--------|
| Keyword import seed | 100 keywords in 51ms |
| `GET /api/healthz` | p50 5ms, p95 6ms, max 7ms |
| `GET /api/auth/me` | p50 11ms, p95 17ms, max 24ms |
| `GET /api/tenant/dashboard` | p50 8ms, p95 11ms, max 36ms |
| `GET /api/clients` | p50 6ms, p95 7ms, max 7ms |
| `GET /api/projects?clientId=:id` | p50 6ms, p95 8ms, max 11ms |
| `GET /api/projects/:id` | p50 6ms, p95 10ms, max 10ms |
| `GET /api/projects/:id/keywords` | p50 11ms, p95 18ms, max 19ms |
| `GET /api/projects/:id/briefs` | p50 7ms, p95 9ms, max 16ms |
| `POST /api/projects/:id/reports` | p50 13ms, p95 21ms, max 21ms |
| `GET /api/projects/:id/export/keywords.csv` | p50 8ms, p95 12ms, max 12ms |
| `GET /api/projects/:id/export/project.json` | p50 11ms, p95 13ms, max 13ms |
| `GET /api/healthz`, concurrency 10 | p50 12ms, p95 20ms, max 79ms, 0 failures |
| `GET /api/tenant/dashboard`, concurrency 10 | p50 32ms, p95 37ms, max 39ms, 0 failures |
| `GET /api/projects/:id/keywords`, concurrency 10 | p50 36ms, p95 43ms, max 44ms, 0 failures |
| `GET /api/projects/:id/export/project.json`, concurrency 5 | p50 42ms, p95 50ms, max 51ms, 0 failures |
| Degraded billing health check | 503 in 12ms; database ok, billing missing config |
| Database outage health check | 503 in 11ms; database error |

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

## Notes

- This is a local baseline, not a hosted staging or production load test.
- The current runner measures local sequential request latency plus small concurrent read/export baselines. It is a release guard for obvious regressions, not a substitute for hosted load testing.
- The page-load runner measures a production frontend build served by a local same-origin harness. It catches blank screens, slow first-visible screen loads, and browser runtime errors on key authenticated pages.
- The degraded health checks cover missing billing configuration and database outage behavior. Future reliability work should add slow external provider behavior and queue backlog behavior.
- Future Phase 38 work should add queue, backup/restore, larger tenant-size, and slow-provider baselines.
