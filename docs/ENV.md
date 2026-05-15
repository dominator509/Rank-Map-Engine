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

## Feature Flags

All feature flags default to `false`. Set to `true` to enable.

| Variable | Description |
| --- | --- |
| `FEATURE_AI_CLUSTERING` | Enable real AI clustering |
| `FEATURE_BILLING` | Enable billing |
| `FEATURE_STRIPE_BILLING` | Enable Stripe billing |
| `FEATURE_AHREFS_IMPORT` | Enable real Ahrefs adapter |
| `FEATURE_SEMRUSH_IMPORT` | Enable real Semrush adapter |
| `FEATURE_SEORX_INTEGRATION` | Enable SEORx adapter |
| `FEATURE_WHITE_LABEL` | Enable white-label configuration |

## AI Providers

| Variable | Required When | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | `FEATURE_AI_CLUSTERING=true` | OpenAI API key |
| `OPENAI_MODEL` | Optional | OpenAI model. Defaults to `gpt-4o-mini`. |
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
| `DATAFORSEO_LOGIN` | DataForSEO import enabled | DataForSEO account login |
| `DATAFORSEO_PASSWORD` | DataForSEO import enabled | DataForSEO account password |

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
| `PREFLIGHT_HEALTH_URL` | Optional after deploy | URL for `/api/healthz/detailed` health verification |
| `PREFLIGHT_SKIP_MIGRATIONS` | Optional | Set `true` to skip migration application |
| `PREFLIGHT_SKIP_LIVE_SERVICES` | Optional | Set `true` to skip live provider diagnostics |
| `PREFLIGHT_ALLOW_NON_PRODUCTION` | Optional | Set `true` for staging/dry-run checks outside `NODE_ENV=production` |
| `PREFLIGHT_ALLOW_INSECURE_APP_URL` | Optional | Set `true` for non-HTTPS private staging URLs |

## Notes

- Use `sk_test_...` and `pk_test_...` Stripe keys in development.
- Use `sk_live_...` and `pk_live_...` Stripe keys only in production secrets.
- Generate `SESSION_SECRET` with a cryptographically secure random generator:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- Apply production database changes with `corepack pnpm run deploy:preflight` or `corepack pnpm run db:migrate`, not `drizzle-kit push`.
