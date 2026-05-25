# White Box Coverage Report

Date: 2026-05-25  
Scope: White-box phases 2-4 targeted suites

## Execution Command

```powershell
$env:DATABASE_URL='postgres://invalid:invalid@127.0.0.1:1/invalid'
corepack pnpm exec vitest run --coverage.enabled true --coverage.all false --coverage.reporter=text `
  artifacts/api-server/src/lib/whitebox-phase2-state.test.ts `
  artifacts/api-server/src/routes/whitebox-phase3-branches.test.ts `
  artifacts/api-server/src/lib/whitebox-phase4-security.test.ts
```

## Test Result Summary

- Test files: 3 passed
- Tests: 14 passed, 0 failed

## Coverage Summary (Measured)

- Statements: 29.95%
- Branches: 73.38%
- Functions: 17.39%
- Lines: 29.95%

## High-Risk Module Coverage (Measured)

- `artifacts/api-server/src/routes/health.ts`
  - Statements: 88.04%
  - Branches: 79.31%
  - Functions: 100%
- `artifacts/api-server/src/routes/billing.ts`
  - Statements: 26.08%
  - Branches: 71.42%
  - Functions: 16.66%
- `artifacts/api-server/src/lib/integration-credentials.ts`
  - Statements: 93.9%
  - Branches: 85.71%
  - Functions: 100%
- `artifacts/api-server/src/lib/input-guards.ts`
  - Statements: 88.88%
  - Branches: 85.71%
  - Functions: 100%

## Dead Code / Unreachable Paths

- No mathematically unreachable dead code was conclusively proven in this pass.
- Several low-coverage route modules remain reachable but unexecuted by this targeted white-box phase and require additional route-specific harnessing for complete path saturation.

## Residual Gaps to Reach 100%

- Large portions of route handlers outside selected high-complexity paths remain uncovered (for example: `briefs.ts`, `keywords.ts`, `projects.ts`, `team.ts`, `tenant.ts`).
- Additional deterministic fixtures/mocks are needed for billing lifecycle branches that require database-backed tenant/subscription transitions.
