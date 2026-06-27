# Task Completion

- Before declaring a coding task complete, choose the narrowest credible verification set and say exactly what ran and what did not run.
- Default local verification ladder for ordinary code changes:
  - `rtk corepack pnpm run format:check`
  - `rtk corepack pnpm run lint`
  - `rtk corepack pnpm run typecheck`
  - `rtk corepack pnpm run test`
- For API route/contract changes, also run `rtk corepack pnpm run api:route-drift:check`; regenerate via `rtk corepack pnpm --filter @workspace/api-spec run codegen` when contract output is intentionally changed.
- For frontend interaction/UI changes, include focused browser/manual or Playwright evidence when feasible; root browser e2e is `rtk corepack pnpm run test:e2e:browser`.
- For backend route/auth/security changes, include focused Vitest files plus `rtk corepack pnpm run test:e2e:api` when route behavior or tenant/session boundaries are touched.
- For DB changes, include `rtk corepack pnpm run db:generate`/migration evidence and any relevant seed/migrate checks; `db:seed` maps to the GEO/AEO demo seed through `@workspace/db`.
- For release/security-sensitive work, include `rtk corepack pnpm run security:check`, `rtk corepack pnpm run deploy:preflight`, and relevant docs/status updates if claims changed.
- `security:check` currently gates high severity via `pnpm audit --audit-level high`; lower/moderate audit noise may still exist and must be reported honestly if observed.
- Git status before handoff: confirm branch, untracked files, and diff. Known untracked non-task paths may include `.serena/memories/` during onboarding; do not stage unrelated paths.