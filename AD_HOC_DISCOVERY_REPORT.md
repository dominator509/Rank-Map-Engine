# AD_HOC_DISCOVERY_REPORT

## Scope

- Campaign type: adversarial exploratory chaos testing.
- Mode: deterministic hypothesis -> anomaly injection -> result capture.
- Application code changes: none.
- Artifacts generated:
  - `artifacts/chaos/CHAOS_TARGET_MAP.md`
  - `artifacts/chaos/phase2-mutation-results.json`
  - `artifacts/chaos/phase3-concurrency-results.json`
  - `artifacts/chaos/phase4-persona-results.json`
  - `scripts/chaos/phase2-mutation.mjs`
  - `scripts/chaos/phase3-concurrency.mjs`
  - `scripts/chaos/phase4-persona-derailment.mjs`

## Confirmed Disruptions

### 1) Unhandled server error and stack trace leakage on oversized client id payload

- Vector: massive integer payload to `POST /api/projects`.
- Repro script: `scripts/chaos/phase2-mutation.mjs`.
- Evidence: `artifacts/chaos/phase2-mutation-results.json` -> `massive-integer-project-create`.
- Observed behavior:
  - HTTP `500`.
  - HTML error page returned with stack trace and SQL details (`projects.ts:41`, query params visible).
- Expected resilience:
  - Input validation should fail early with `400`.
  - No stack trace/SQL metadata leakage in response body.

### 2) Unhandled server error and stack trace leakage on null-byte email invite payload

- Vector: special-character flood including `\u0000` in `POST /api/team/invite`.
- Repro script: `scripts/chaos/phase2-mutation.mjs`.
- Evidence: `artifacts/chaos/phase2-mutation-results.json` -> `team-invite-special-char-flood`.
- Observed behavior:
  - HTTP `500`.
  - HTML error body with SQL and stack trace (`team.ts:145`).
- Expected resilience:
  - Strict input sanitization/rejection with `4xx`.
  - No internal stack/query leakage.

### 3) Unexpected acceptance of extremely deep nested object payload

- Vector: deeply nested object (`depth=1400`) for tenant white-label config.
- Repro script: `scripts/chaos/phase2-mutation.mjs`.
- Evidence: `artifacts/chaos/phase2-mutation-results.json` -> `deeply-nested-tenant-patch`.
- Observed behavior:
  - HTTP `200` and state persisted.
  - No depth/size guard despite potential memory/performance risk.
- Expected resilience:
  - Depth/size caps with structured `4xx` rejection.

## High-Stress Behavioral Observations

### Concurrency burst on project creation remained consistent

- Vector: 30 concurrent `POST /api/projects`.
- Evidence: `artifacts/chaos/phase3-concurrency-results.json`.
- Result:
  - `30/30` requests returned `201`.
  - Post-race state count matched expected cardinality (`projectRows: 30`).

### Repeated invite race was blocked by plan gate

- Vector: 12 concurrent `POST /api/team/invite` for same email.
- Evidence: `artifacts/chaos/phase3-concurrency-results.json`.
- Result:
  - `12/12` returned `402` (plan/limit gate), no invite rows inserted.

### Session logout does not invalidate API-key authentication

- Vector: API key used before and after session logout.
- Evidence: `artifacts/chaos/phase4-persona-results.json` -> `api-key-reuse-after-session-logout`.
- Result:
  - `200` before logout and `200` after logout (expected for decoupled auth).
  - After key revocation, replay correctly returned `401`.

## Commands Used for Execution

- All runtime phases executed against ephemeral Postgres containers with schema migration before attack execution.
- Core run pattern:
  - `pnpm --filter @workspace/db run migrate`
  - `pnpm exec tsx scripts/chaos/<phase-script>.mjs`

## Triage Summary

- Severity high:
  - Two reproducible `500` paths with internal stack/query leakage.
- Severity medium:
  - Deep nested object accepted without bounded validation.
- Severity informational:
  - API key remains valid after session logout by design; revocation flow works when key is explicitly revoked.
