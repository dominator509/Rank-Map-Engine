# RankMap — Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately. Do not open a public issue.

Contact: security@rankmap.io *(placeholder — update before launch)*

---

## Security Practices

### Secrets Management

- **No hardcoded secrets.** All credentials, API keys, and tokens must be set via environment variables.
- `.env` is in `.gitignore` and must never be committed.
- `.env.example` contains only fake placeholder values (e.g., `your-secret-here`).
- ESLint is configured to flag patterns that look like hardcoded secrets.
- All production secrets are managed via Replit's secret store.

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
- CORS restricted to known origins in production.

### Third-Party Integrations

- Real integration adapters (Ahrefs, Semrush, Stripe) are feature-flagged.
- Mock adapters are always available and require no credentials.
- Integration credentials encrypted in `IntegrationCredential.encrypted_api_key`.

### Dependency Security

- `pnpm audit` run after each major dependency change.
- Dependabot / manual review for critical CVEs.
- No `--ignore-scripts` bypass in production installs.

### Logging

- No PII (email, passwords, API keys) in logs.
- `pino` used throughout — structured JSON logs in production.
- `console.log` in server code flagged by ESLint (`no-console` rule).

### Deployment (Replit)

- Production environment variables set in Replit secret store.
- `NODE_ENV=production` in production deployments.
- Health endpoint (`/api/healthz`) does not expose internal details.

---

## Security Checklist (Per Phase)

Before each phase ships:

- [ ] `pnpm audit` — no critical/high CVEs
- [ ] `pnpm run lint` — no hardcoded secret patterns
- [ ] New routes have `requireRole()` middleware
- [ ] New queries include `tenant_id` filter
- [ ] No PII logged
- [ ] `.env.example` updated (if new env vars added)
- [ ] `docs/ENV.md` updated

---

*Last updated: Phase 0.*
