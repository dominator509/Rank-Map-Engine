# Launch Readiness

Phase 39 is the final launch-readiness and operational handoff phase. This document is the canonical sign-off record.

## Current Decision

**Status:** No-go for production launch until real-provider smoke tests pass and operational sign-off evidence is attached.

Local Phase 38 baselines are complete, and hosted Render staging is live with passing smoke/load evidence. Launch sign-off still requires successful real-provider smoke evidence, hosted backup/PITR confirmation, monitoring/alerting confirmation, rollback rehearsal, and owner approvals.

## Required Sign-Off Evidence

| Evidence | Status | Required Before Launch |
| --- | --- | --- |
| Local release gates | Passed latest full run on 2026-06-01 | Yes |
| Local API/performance baselines | Passed in Phase 38 | Yes |
| Local page-load baseline | Passed in Phase 38 | Yes |
| Local backup/restore proof | Passed in Phase 38 | Yes |
| Hosted staging health/preflight | Passed on Render staging | Yes |
| Hosted staging load test | Passed on Render staging | Yes |
| Real-provider smoke tests | Failed: OpenAI quota exceeded; other provider credentials missing | Yes |
| Billing smoke test | Pending Stripe test/live staging config | Yes if billing is enabled |
| Backup/PITR configured in hosted database | Pending infrastructure confirmation | Yes |
| Monitoring/alerting live | Pending infrastructure confirmation | Yes |
| Rollback rehearsal | Pending staging deployment | Yes |
| Legal/privacy/retention approval | Pending owner approval | Yes |

## Local Evidence Already Available

| Check | Command | Evidence Location |
| --- | --- | --- |
| Latest release gate sweep | `format:check`, `lint`, `security:secrets`, `api:route-drift:check`, `typecheck`, `test`, `test:e2e:api`, `build`, `audit --prod`, `git diff --check` | This document |
| API latency, export/report, queue, degraded health | `pnpm run perf:baseline` | `docs/PERFORMANCE_BASELINE.md` |
| Production page-load baseline | `pnpm run perf:pages` | `docs/PERFORMANCE_BASELINE.md` |
| Large tenant-size baseline | `pnpm run perf:tenant-size` | `docs/PERFORMANCE_BASELINE.md` |
| Slow-provider fallback | `pnpm run perf:slow-provider` | `docs/PERFORMANCE_BASELINE.md` |
| Backup/restore proof | `pnpm run recovery:baseline` | `docs/BACKUP_RESTORE.md` |
| Release preflight | `pnpm run deploy:preflight` | `docs/RELEASE.md` |
| Live service diagnostics | `pnpm run test:live:services` | This document after credentials are available |

Latest local release gate sweep: 2026-06-01.

| Check | Result |
| --- | --- |
| `rtk corepack pnpm run format:check` | Pass |
| `rtk corepack pnpm run lint` | Pass |
| `rtk corepack pnpm run security:secrets` | Pass |
| `rtk corepack pnpm run api:route-drift:check` | Pass, 0 undocumented and 0 stale operations |
| `rtk corepack pnpm run typecheck` | Pass |
| `rtk corepack pnpm run test` | Pass, 51 passed and 4 skipped |
| `rtk corepack pnpm run test:e2e:api` | Pass, 2 passed |
| `rtk corepack pnpm run build` | Pass |
| `rtk corepack pnpm audit --prod` | Pass, no known vulnerabilities found |
| `rtk git diff --check` | Pass |

## Hosted Staging Load-Test Evidence

Attach the result here before launch.

Required staging conditions:

- Staging runs a production build, not a dev server.
- Staging uses a production-like PostgreSQL instance.
- Migrations have been applied through the release path.
- `PREFLIGHT_HEALTH_URL` points at `/api/healthz/detailed` and `HEALTH_CHECK_TOKEN` is set for detailed health evidence.
- Billing, AI, email, and keyword providers are configured according to the launch scope.

Minimum hosted load-test coverage:

- Authenticated dashboard reads.
- Client and project list/detail reads.
- Keyword list reads for a large project.
- Report generation and export paths.
- AI task/backlog reads.
- Health/readiness under dependency degradation where the staging setup supports it.

Run the staging smoke/load runner:

```powershell
$env:STAGING_BASE_URL = "https://staging.example.com"
$env:STAGING_OPERATOR = "operator-name"
pnpm run staging:smoke-load
```

Useful options:

| Variable | Default | Purpose |
| --- | --- | --- |
| `STAGING_BASE_URL` | Required | Hosted staging app URL. |
| `STAGING_OPERATOR` | Current OS user | Person running the launch evidence check. |
| `STAGING_TEST_EMAIL` / `STAGING_TEST_PASSWORD` | Auto-generated account | Existing staging account to reuse. If omitted, the runner registers a new staging workspace. |
| `STAGING_KEYWORD_COUNT` | `250` | Number of keywords seeded into the staging project. |
| `STAGING_LOAD_CONCURRENCY` | `5` | Concurrent API workers per measured endpoint. |
| `STAGING_LOAD_REQUESTS` | `25` | Requests per measured endpoint. |
| `STAGING_API_P95_BUDGET_MS` | `1500` | p95 budget for hosted API load checks. |
| `STAGING_PAGE_BUDGET_MS` | `5000` | visible-page budget for hosted browser smoke checks. |
| `STAGING_EVIDENCE_DIR` | `artifacts/staging-launch` | Evidence output directory. |

The runner writes:

- `artifacts/staging-launch/staging-smoke-load-evidence.md`
- `artifacts/staging-launch/staging-smoke-load-evidence.json`

Latest hosted staging result:

| Field | Value |
| --- | --- |
| Staging URL | `https://rank-map-engine.onrender.com` |
| Test date | `2026-05-23T16:19:25.294Z` |
| Dataset size | 250 keywords, 1 client, 1 project, 1 report, 1 AI task |
| Tool/runner | `pnpm run staging:smoke-load` |
| Peak virtual users / concurrency | 5 |
| Duration | 48916ms |
| p95 latency summary | healthz 960ms, dashboard 684ms, clients 264ms, projects 267ms, keywords 729ms, keyword-export 309ms, project-export 843ms, ai-tasks 280ms |
| Error rate | 0.00% |
| Operator | domin |
| Result | PASS |

## Real-Provider Smoke Evidence

Run with staging credentials available:

```powershell
$env:LIVE_SERVICES_OPTIONAL = "0"
$env:LIVE_KEYWORD_PROVIDER_CHECKS = "true"
pnpm run test:live:services
```

Required provider evidence:

| Provider | Required When | Status | Evidence |
| --- | --- | --- | --- |
| OpenAI | AI clustering/briefs enabled | Pending | Pending |
| Stripe API | Billing enabled | Pending | Pending |
| Stripe webhook secret/config | Billing enabled | Pending | Pending |
| SMTP | Email enabled | Pending | Pending |
| Ahrefs | Ahrefs import enabled | Pending | Pending |
| Semrush | Semrush import enabled | Pending | Pending |
| DataForSEO | DataForSEO import enabled | Pending | Pending |

Latest local credential availability check: 2026-05-22.

| Check | Result |
| --- | --- |
| Command | `LIVE_SERVICES_OPTIONAL=1 LIVE_KEYWORD_PROVIDER_CHECKS=true pnpm run test:live:services` |
| OpenAI | Skipped, missing `OPENAI_API_KEY` |
| Stripe billing config | Skipped, missing Stripe secrets/prices |
| Stripe API | Skipped, missing `STRIPE_SECRET_KEY` |
| SMTP | Skipped, missing `SMTP_HOST` |
| Ahrefs | Skipped, missing `AHREFS_API_KEY` |
| Semrush | Skipped, missing `SEMRUSH_API_KEY` |
| DataForSEO | Skipped, missing `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` |
| Launch impact | Real-provider smoke evidence remains pending |

Latest hosted real-provider smoke check: 2026-05-24.

| Check | Result |
| --- | --- |
| Staging URL | `https://rank-map-engine.onrender.com` |
| OpenAI | Failed, API returned quota exceeded (`HTTP 429`) |
| Stripe billing config | Skipped, missing Stripe secrets/prices |
| Stripe API | Skipped, missing `STRIPE_SECRET_KEY` |
| SMTP | Skipped, missing `SMTP_HOST` |
| Ahrefs | Skipped, missing `AHREFS_API_KEY` |
| Semrush | Skipped, missing `SEMRUSH_API_KEY` |
| DataForSEO | Skipped, missing `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` |
| Hosted health | Passed, `/api/healthz/detailed` returned `ok` |
| Launch impact | Real-provider smoke evidence is blocked by OpenAI quota and missing provider credentials |

## Production Handoff Checklist

| Area | Status | Notes |
| --- | --- | --- |
| Deployment owner identified | Pending | Name owner before launch. |
| Incident owner identified | Pending | Name escalation owner before launch. |
| Rollback procedure rehearsed | Pending | Rehearse in staging. |
| Database backups enabled | Pending | Confirm managed backup policy and retention. |
| Point-in-time recovery enabled | Pending | Required where provider supports it. |
| Monitoring dashboards live | Pending | API, database, queue/jobs, providers, billing. |
| Alerting live | Pending | Health, error rate, latency, database, billing/webhooks. |
| Secrets stored in managed secret store | Pending | No `.env` files on production hosts. |
| Legal/privacy/retention approved | Pending | Confirm policy owner approval. |

## Go/No-Go

Current decision: **No-go**.

Known blockers:

- Real-provider smoke-test evidence has not passed.
- Production backup/PITR and monitoring/alerting are not confirmed.
- Rollback rehearsal is not recorded.

Launch can move to go only after each required evidence row above has a dated result and owner.
