# RankMap Environment Variable Reference

Copy `.env.example` to `.env` for local development. Never commit `.env`.

## Core

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | Runtime environment | `development` / `production` |
| `PORT` | Yes | Server port | `3000` |
| `APP_URL` | Yes | Public app URL used for billing redirects and release checks | `https://app.example.com` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/rankmap` |
| `SESSION_SECRET` | Yes | Session signing secret, at least 32 random characters | `generated-random-secret` |
| `INTEGRATION_CREDENTIALS_KEY` | Production | Dedicated encryption key for stored integration credentials. Falls back to `SESSION_SECRET` only outside the release gate. | 32-byte random base64 or hex |
| `HEALTH_CHECK_TOKEN` | Production | Bearer token for `/api/healthz/detailed`, staging smoke/load, and preflight detailed health checks | `generated-random-token` |
| `STATIC_ASSETS_DIR` | Optional | Absolute path to the built React assets when the API server serves the frontend | `/opt/render/project/src/artifacts/rankmap/dist/public` |

## Feature Flags

All feature flags default to `false`. Set to `true` to enable.

| Variable | Description |
| --- | --- |
| `FEATURE_AI_CLUSTERING` | Enable real AI clustering |
| `FEATURE_BILLING` | Enable billing |
| `FEATURE_STRIPE_BILLING` | Enable Stripe billing |
| `FEATURE_AHREFS_IMPORT` | Enable real Ahrefs adapter |
| `FEATURE_SEMRUSH_IMPORT` | Enable real Semrush adapter |
| `FEATURE_DATAFORSEO_IMPORT` | Enable real DataForSEO adapter |
| `FEATURE_WHITE_LABEL` | Enable white-label configuration |

## GEO/AEO Audit

The GEO/AEO workflow is manual/mock first. Real answer-engine calls must stay disabled unless a later approved integration path explicitly enables them.

| Variable | Required When | Description |
| --- | --- | --- |
| `GEO_AEO_ENABLED` | Optional | Enables the GEO/AEO module. Defaults to `false` when unset in code; `.env.example` enables local/manual development. |
| `MOCK_ANSWER_ENGINE_ENABLED` | GEO/AEO enabled | Keeps deterministic mock answer-engine collection available. |
| `REAL_ANSWER_ENGINE_CALLS_ENABLED` | Optional | Global guard for any real answer-engine call. Defaults to `false`. |
| `MANUAL_GEO_AEO_SNAPSHOTS_ENABLED` | GEO/AEO enabled | Allows operators to paste/import answer snapshots manually. |
| `GOOGLE_AI_OVERVIEWS_MANUAL_ONLY` | Always | Must remain `true`; automated scraping is not supported. |
| `PERPLEXITY_ENABLED` | Real Perplexity scaffold | Requires `REAL_ANSWER_ENGINE_CALLS_ENABLED=true` and `PERPLEXITY_API_KEY`. |
| `PERPLEXITY_API_KEY` | `PERPLEXITY_ENABLED=true` with real calls | Perplexity API key. Leave blank in local/CI. |
| `GEMINI_VISIBILITY_ENABLED` | Future Gemini scaffold | Enables Gemini visibility scaffold only where supported. |
| `CHATGPT_VISIBILITY_MANUAL_ONLY` | Always | Must remain `true` unless an approved official path is added. |
| `AI_VISIBILITY_MONTHLY_MONITORING_ENABLED` | Optional | Enables future monthly monitoring workflow. |

## AI Providers

| Variable | Required When | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | `FEATURE_AI_CLUSTERING=true` | OpenAI API key |
| `OPENAI_MODEL` | Optional | OpenAI model. Defaults to `gpt-4o-mini`. |
| `OPENAI_BASE_URL` | Optional | OpenAI-compatible API base URL. Defaults to `https://api.openai.com/v1`. |
| `OPENAI_TIMEOUT_MS` | Optional | OpenAI-compatible request timeout in milliseconds. Defaults to `30000`. |
| `ANTHROPIC_API_KEY` | Future Anthropic support | Anthropic API key |

## Stripe

| Variable | Required When | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Billing enabled | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Billing enabled | Stripe webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | Billing enabled | Stripe publishable key |
| `STRIPE_PRICE_SOLO` | Billing enabled | Stripe recurring price id for the Solo plan |
| `STRIPE_PRICE_AGENCY` | Billing enabled | Stripe recurring price id for the Agency plan |
| `STRIPE_PRICE_ENTERPRISE` | Billing enabled | Stripe recurring price id for the Enterprise plan |

## Integration Adapters

| Variable | Required When | Description |
| --- | --- | --- |
| `AHREFS_API_KEY` | `FEATURE_AHREFS_IMPORT=true` | Ahrefs API key |
| `SEMRUSH_API_KEY` | `FEATURE_SEMRUSH_IMPORT=true` | Semrush API key |
| `ALLOW_SEMRUSH_QUERY_AUTH` | `FEATURE_SEMRUSH_IMPORT=true` | Set `true` only when explicitly accepting Semrush's query-string API key requirement |
| `DATAFORSEO_LOGIN` | `FEATURE_DATAFORSEO_IMPORT=true` | DataForSEO account login |
| `DATAFORSEO_PASSWORD` | `FEATURE_DATAFORSEO_IMPORT=true` | DataForSEO account password |

## Email

| Variable | Required When | Description |
| --- | --- | --- |
| `SMTP_HOST` | SMTP email enabled | SMTP host |
| `SMTP_PORT` | SMTP email enabled | SMTP port, usually `587` or `465` |
| `SMTP_USER` | SMTP email enabled | SMTP username |
| `SMTP_PASS` | SMTP email enabled | SMTP password |
| `EMAIL_FROM` | Optional | Sender address. Defaults to `SMTP_USER`. |

## Release Preflight

| Variable | Required When | Description |
| --- | --- | --- |
| `PREFLIGHT_HEALTH_URL` | Optional after deploy | URL for `/api/healthz/detailed` health verification. Sends `HEALTH_CHECK_TOKEN` as a bearer token when set. |
| `PREFLIGHT_SKIP_MIGRATIONS` | Optional | Set `true` to skip migration application |
| `PREFLIGHT_SKIP_LIVE_SERVICES` | Optional | Set `true` to skip live provider diagnostics |
| `PREFLIGHT_ALLOW_NON_PRODUCTION` | Optional | Set `true` for staging/dry-run checks outside `NODE_ENV=production` |
| `PREFLIGHT_ALLOW_INSECURE_APP_URL` | Optional | Set `true` for non-HTTPS private staging URLs |

## Render Staging

The repository root `render.yaml` defines a single Render web service for staging. It expects `APP_URL` and `DATABASE_URL` to be entered as Render secrets during Blueprint setup, generates `SESSION_SECRET`, `INTEGRATION_CREDENTIALS_KEY`, and `HEALTH_CHECK_TOKEN`, builds the React app with `BASE_PATH=/`, and serves the built frontend through the API server.

See [`docs/STAGING_SETUP.md`](./STAGING_SETUP.md) for the full mostly-free Neon + Render + Cloudflare staging path.

## Notes

- Use `sk_test_...` and `pk_test_...` Stripe keys in development.
- Use `sk_live_...` and `pk_live_...` Stripe keys only in production secrets.
- Generate `SESSION_SECRET` with a cryptographically secure random generator:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- Apply production database changes with `corepack pnpm run deploy:preflight` or `corepack pnpm run db:migrate`, not `drizzle-kit push`.
