# Production Release Gate

This repository should only be deployed from a commit that has passed CI.

## CI Gate

GitHub Actions runs the release checks in `.github/workflows/ci.yml`:

- generated migration and API client drift check
- format check
- lint
- typecheck
- unit tests
- API E2E against a migrated disposable Postgres database
- production build

## Deploy Preflight

Run this before starting a production release:

```powershell
$env:NODE_ENV="production"
$env:DATABASE_URL="postgresql://..."
$env:SESSION_SECRET="..."
$env:PORT="3000"
$env:APP_URL="https://app.example.com"
corepack pnpm run deploy:preflight
```

The preflight checks required production environment variables, applies pending database migrations, and runs live-service diagnostics when real provider credentials are configured.

Phase 39 launch sign-off is tracked in [`docs/LAUNCH_READINESS.md`](./LAUNCH_READINESS.md). Do not treat local preflight as launch approval by itself; hosted staging load-test evidence and real-provider smoke-test evidence must be attached there.

After the new app version is running, check the deployed health endpoint:

```powershell
$env:PREFLIGHT_HEALTH_URL="https://app.example.com/api/healthz/detailed"
corepack pnpm run deploy:preflight
```

## Useful Flags

- `PREFLIGHT_SKIP_MIGRATIONS=true` skips `db:migrate`.
- `PREFLIGHT_SKIP_LIVE_SERVICES=true` skips live provider checks.
- `PREFLIGHT_HEALTH_URL=https://.../api/healthz/detailed` verifies the deployed app is healthy.
- `PREFLIGHT_ALLOW_NON_PRODUCTION=true` allows a dry run outside `NODE_ENV=production`.
- `PREFLIGHT_ALLOW_INSECURE_APP_URL=true` allows non-HTTPS app URLs for private staging.

## Required Production Secrets

Always required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET`
- `PORT`
- `APP_URL` or `PUBLIC_APP_URL`

Required when billing is enabled:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SOLO`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_PRICE_ENTERPRISE`

Required when live features are enabled:

- `OPENAI_API_KEY` for `FEATURE_AI_CLUSTERING=true`
- `AHREFS_API_KEY` for `FEATURE_AHREFS_IMPORT=true`
- `SEMRUSH_API_KEY` for `FEATURE_SEMRUSH_IMPORT=true`
- `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` when SMTP email is configured
