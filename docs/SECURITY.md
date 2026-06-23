# RankMap — Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately. Do not open a public issue.

Contact: security@rankmap.io *(placeholder — update before launch)*

---

## Security Practices

The application threat model is maintained in [`docs/THREAT_MODEL.md`](./THREAT_MODEL.md).

### Secrets Management

- **No hardcoded secrets.** All credentials, API keys, and tokens must be set via environment variables.
- `.env` is in `.gitignore` and must never be committed.
- `.env.example` contains only fake placeholder values (e.g., `your-secret-here`).
- ESLint and `pnpm run security:secrets` flag patterns that look like hardcoded secrets.
- All production secrets are managed via the hosting provider's secret store.

### Authentication & Sessions

- Session-based authentication (Phase 1+).
- Sessions stored in PostgreSQL (`connect-pg-simple`).
- `SESSION_SECRET` must be a cryptographically random string (≥ 32 bytes).
- Cookies: `httpOnly: true`, `secure: true` in production, `sameSite: "strict"`.
- Password hashing: bcrypt with cost factor ≥ 12.

### Authorization (RBAC)

- Role-based access control enforced **server-side** in route middleware.
- Client-side role checks are UI conveniences only — never the security boundary.
- Roles: `super_admin`, `agency_admin`, `agency_user`, `client`.
- Every route handler must declare its required role via `requireRole()` middleware.

### Tenant Isolation

- All database queries include `tenant_id` filter.
- Cross-tenant data access is blocked at the service layer.
- Tenant isolation is tested with integration tests before each phase ships.

### Database

- Parameterized queries only. No string interpolation for user-controlled values.
- Integration credentials (API keys) stored encrypted at rest.
- Drizzle ORM schemas define column-level constraints.

### API Security

- All API inputs validated with Zod schemas before processing.
- Error responses do not expose stack traces or internal details in production.
- Rate limiting applied at `/api/*` (Phase 1+).
- Sensitive route families have tighter scoped rate limits: auth, API key management, webhook management, provider search, exports/reports, AI-heavy workflows, ranking checks, and Stripe webhook verification.
- CORS restricted to known origins in production.

### Third-Party Integrations

- Real integration adapters (Ahrefs, Semrush, Stripe) are feature-flagged.
- Mock adapters are always available and require no credentials.
- Integration credentials are encrypted with AES-256-GCM before being stored in the `integration_credentials.credentials` JSONB column.
- Legacy plaintext integration credential rows are re-encrypted on API server startup.
- Semrush live API calls are disabled by default because Semrush requires the API key as a request parameter; set `ALLOW_SEMRUSH_QUERY_AUTH=true` only after explicitly accepting that provider constraint.

### Dependency Security

- `pnpm run security:audit` runs `pnpm audit --audit-level high` after each major dependency change.
- `pnpm run security:check` combines committed-secret scanning with the high/critical dependency audit and runs in CI.
- Dependabot / manual review for critical CVEs.
- No `--ignore-scripts` bypass in production installs.

### Logging

- No PII (email, passwords, API keys) in logs.
- `pino` used throughout — structured JSON logs in production.
- `console.log` in server code flagged by ESLint (`no-console` rule).

### Deployment

- Production environment variables set in the hosting provider's secret store.
- `NODE_ENV=production` in production deployments.
- `INTEGRATION_CREDENTIALS_KEY` and `HEALTH_CHECK_TOKEN` are required by release preflight.
- Public health endpoint (`/api/healthz`) does not expose internal details.
- Detailed health endpoint (`/api/healthz/detailed`) requires `HEALTH_CHECK_TOKEN` or a `super_admin` session.

---

## Security Checklist (Per Phase)

Before each phase ships:

- [ ] `pnpm run security:check` — no committed secret patterns and no high/critical CVEs
- [ ] `pnpm run lint` — no hardcoded secret patterns in linted source
- [ ] New routes have `requireRole()` middleware
- [ ] New queries include `tenant_id` filter
- [ ] No PII logged
- [ ] `.env.example` updated (if new env vars added)
- [ ] `docs/ENV.md` updated

---

*Last updated: 2026-05-31.*
