# RankMap GEO/AEO Test Plan

## G1/G2 Focused Tests

- Environment flag defaults keep manual/mock enabled and real answer-engine calls disabled.
- Real-call validation blocks unsupported direct ChatGPT/Google AI Overview modes.
- Perplexity scaffold requires `PERPLEXITY_API_KEY` only when enabled with real calls.
- AI Visibility Score normalizes non-finite, missing, low, and high inputs to `0-100`.
- AI Visibility Score clamps final output to `0-100`.
- Score labels cover all thresholds.
- Score explanations are returned from the shared module.
- Snapshot and prompt schemas reject missing required fields.
- CSV cell neutralization prefixes formula-leading cells.

## Later Required Coverage

- Drizzle migration and tenant indexes.
- Prompt CSV import and snapshot CSV import.
- Manual and mock answer-engine adapter contracts.
- AI task output schemas and deterministic mock outputs.
- Tenant isolation and RBAC route tests.
- Approval visibility tests proving client dashboards hide drafts.
- Markdown, CSV, and PDF report generation through existing export permissions.
- Manual fallback smoke path from audit creation to approved export.

## Command Mapping

The repo uses pnpm scripts:

```bash
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run test:e2e:api
pnpm run test:e2e:browser
pnpm run security:check
pnpm run build
```

Focused GEO/AEO unit tests can be run with:

```bash
pnpm exec vitest run lib/shared/src/geo-aeo
```
