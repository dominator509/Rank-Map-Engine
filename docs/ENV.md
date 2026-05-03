# RankMap — Environment Variable Reference

> Copy `.env.example` to `.env` and fill in real values for local development.  
> **Never commit `.env`.** Production secrets are managed via Replit's secret store.

---

## Core

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Runtime environment | `development` / `production` |
| `PORT` | Yes (auto) | Server port — set by Replit automatically | `3000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/rankmap` |
| `SESSION_SECRET` | Yes (Phase 1+) | Session signing secret — min 32 random bytes | `change-me-to-a-long-random-secret` |

---

## Feature Flags

All feature flags default to `false`. Set to `true` to enable.

| Variable | Phase | Description |
|----------|-------|-------------|
| `FEATURE_AI_CLUSTERING` | 5 | Enable real AI clustering (mock used when false) |
| `FEATURE_STRIPE_BILLING` | 10 | Enable Stripe billing (manual plan when false) |
| `FEATURE_AHREFS_IMPORT` | 11 | Enable real Ahrefs adapter |
| `FEATURE_SEMRUSH_IMPORT` | 12 | Enable real Semrush adapter |
| `FEATURE_SEORX_INTEGRATION` | 13 | Enable SEORx adapter |
| `FEATURE_WHITE_LABEL` | 9 | Enable white-label configuration |

---

## AI Providers (Phase 5+)

| Variable | Required When | Description |
|----------|---------------|-------------|
| `OPENAI_API_KEY` | `FEATURE_AI_CLUSTERING=true` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Phase 14+ | Anthropic API key |

---

## Stripe (Phase 10+)

| Variable | Required When | Description |
|----------|---------------|-------------|
| `STRIPE_SECRET_KEY` | `FEATURE_STRIPE_BILLING=true` | Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `FEATURE_STRIPE_BILLING=true` | Stripe webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | `FEATURE_STRIPE_BILLING=true` | Stripe publishable key (`pk_live_...`) |

---

## Integration Adapters (Phase 11–13)

| Variable | Required When | Description |
|----------|---------------|-------------|
| `AHREFS_API_KEY` | `FEATURE_AHREFS_IMPORT=true` | Ahrefs API key |
| `SEMRUSH_API_KEY` | `FEATURE_SEMRUSH_IMPORT=true` | Semrush API key |

---

## Notes

- Use `sk_test_...` / `pk_test_...` Stripe keys in development.
- `SESSION_SECRET` must be generated with a cryptographically secure random generator:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `DATABASE_URL` is automatically set by Replit when you provision a PostgreSQL database.

---

*Last updated: Phase 0.*
