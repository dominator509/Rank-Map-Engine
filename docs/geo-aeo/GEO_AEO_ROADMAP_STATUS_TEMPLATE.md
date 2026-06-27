# GEO/AEO Implementation Status Template

Copy this into `docs/geo-aeo/IMPLEMENTATION_STATUS.md` or add it as a section in the existing `ROADMAP_STATUS.md`.

# GEO/AEO IMPLEMENTATION STATUS

## Current GEO/AEO Phase

G0 — Discovery, Scope Lock, and Docs

## Current Task

Read existing RankMap architecture/roadmap/status/security docs, inspect repo patterns, and create GEO/AEO implementation docs.

## Previous Completed Phase

None.

## Next Planned Phase

G1 — Feature Flags and Environment Validation

## Feature Scope

Add a GEO/AEO Audit workflow to RankMap for AI visibility audits across ChatGPT, Gemini, Perplexity, and Google AI Overviews using manual/mock-first answer snapshots, competitor comparison, citation/source gaps, FAQ/schema findings, AI-citable page recommendations, 30-day action plans, approval workflow, client dashboard visibility, and report exports.

## Non-Goals

- No app rebuild.
- No replacement of RankMap SEO/content strategy.
- No unauthorized scraping.
- No guaranteed AI rankings/citations.
- No real paid API requirement.
- No client-visible drafts.

## Phase Checklist

### G0 — Discovery, Scope Lock, and Docs

- [ ] Read `ARCHITECTURE.md`.
- [ ] Read `BUILD_ROADMAP.md`.
- [ ] Read `ROADMAP_STATUS.md`.
- [ ] Read `SECURITY.md`.
- [ ] Read `AGENTS.md`.
- [ ] Inspect framework/routing.
- [ ] Inspect ORM/migrations.
- [ ] Inspect auth/session.
- [ ] Inspect RBAC.
- [ ] Inspect tenant helpers.
- [ ] Inspect audit logs.
- [ ] Inspect AI task runner/adapters.
- [ ] Inspect report/export system.
- [ ] Create/update GEO/AEO docs.

### G1 — Feature Flags and Environment Validation

- [ ] Add `.env.example` placeholders.
- [ ] Add env validation.
- [ ] Add env tests.
- [ ] Confirm real answer-engine calls disabled by default.

### G2 — Shared Domain Constants, Schemas, and Scoring

- [ ] Add constants/enums.
- [ ] Add schemas.
- [ ] Add centralized scoring module.
- [ ] Add scoring tests.

### G3 — Database Migration and Seed Additions

- [ ] Add additive migration.
- [ ] Add indexes.
- [ ] Add tenant scoping.
- [ ] Add seed data.
- [ ] Add migration/seed tests.

### G4 — RBAC, Tenant Helpers, and Audit Logs

- [ ] Add permissions.
- [ ] Seed role permissions.
- [ ] Add scoped access helpers.
- [ ] Add audit log events.
- [ ] Add RBAC/tenant tests.

### G5 — Services and Thin API Routes

- [ ] Add services.
- [ ] Add API routes/controllers.
- [ ] Add validation.
- [ ] Add pagination/filtering where needed.
- [ ] Add integration tests.

### G6 — Prompt Entry and CSV Prompt Import

- [ ] Add manual prompt entry.
- [ ] Add CSV parser.
- [ ] Add preview.
- [ ] Add duplicate detection.
- [ ] Add CSV injection tests.

### G7 — Manual and CSV Answer Snapshot Import

- [ ] Add manual snapshot paste.
- [ ] Add CSV snapshot parser.
- [ ] Add citation URL capture.
- [ ] Add manual mention/citation edits.
- [ ] Add rollback/delete import.

### G8 — Answer-Engine Adapter Registry

- [ ] Add adapter interface.
- [ ] Add registry.
- [ ] Add manual adapter.
- [ ] Add CSV adapter.
- [ ] Add mock adapter.
- [ ] Add ChatGPT manual adapter.
- [ ] Add Gemini scaffold.
- [ ] Add Perplexity scaffold.
- [ ] Add Google AIO manual adapter.
- [ ] Add contract tests.

### G9 — AI Analysis Task Registry Additions

- [ ] Add prompt templates.
- [ ] Add output schemas.
- [ ] Add mock outputs.
- [ ] Add task run logging.
- [ ] Add validation/error tests.

### G10 — Findings, Scores, Competitor Comparison, and Citation Gaps

- [ ] Generate visibility score.
- [ ] Generate competitor comparison.
- [ ] Generate prompt matrix.
- [ ] Generate citation gaps.
- [ ] Generate FAQ/schema/entity findings.
- [ ] Add manual score override.

### G11 — Admin UI

- [ ] Add audit list.
- [ ] Add new audit wizard.
- [ ] Add prompt manager.
- [ ] Add snapshot UI.
- [ ] Add visibility matrix.
- [ ] Add findings views.
- [ ] Add scorecard.
- [ ] Add fallback states.

### G12 — Approval Workflow Integration

- [ ] Add approval item types if needed.
- [ ] Approve/edit/regenerate/delete findings.
- [ ] Hide drafts from clients.
- [ ] Audit approval actions.

### G13 — 30-Day Action Plan and Brief Conversion

- [ ] Generate action plan.
- [ ] Add manual action item editing.
- [ ] Add week grouping.
- [ ] Add conversion to brief/roadmap/proposal where supported.

### G14 — Report Builder and Exports

- [ ] Add report type.
- [ ] Add report sections.
- [ ] Add Markdown export.
- [ ] Add CSV export.
- [ ] Add PDF export where supported.
- [ ] Add report access tests.

### G15 — Client Dashboard and Licensing

- [ ] Add client dashboard section.
- [ ] Show approved findings only.
- [ ] Enforce license/download permissions server-side.

### G16 — Monthly Monitoring Scaffold

- [ ] Add monitoring cadence fields.
- [ ] Add repeat snapshot batches.
- [ ] Add month-over-month comparison.
- [ ] Add monthly report template.

### G17 — Security Hardening and QA

- [ ] Run full feature tests.
- [ ] Run security tests.
- [ ] Run build.
- [ ] Run smoke.
- [ ] Update docs and limitations.

## Acceptance Criteria

- Admin can create a GEO/AEO audit.
- Admin can enter/import prompts.
- Admin can paste/import answer snapshots.
- Manual/mock adapters work without real keys.
- AI analysis extracts mentions/citations/issues with validated outputs.
- AI Visibility Score is centralized and tested.
- Competitor comparison and citation gaps work.
- FAQ/schema/entity recommendations work.
- 30-day action plan works.
- Approval is required before client visibility.
- Client dashboard shows approved insights only.
- Reports export in supported formats.
- Manual fallback can complete a paid audit.
- RBAC and tenant isolation are enforced.
- Sensitive actions are audited.
- Known limitations are documented.

## Implementation Log

| Date       | Phase | Work Completed                           | Notes |
| ---------- | ----- | ---------------------------------------- | ----- |
| YYYY-MM-DD | G0    | Started GEO/AEO docs and repo discovery. |       |

## Files Changed

- `docs/geo-aeo/ARCHITECTURE_ADDENDUM.md`
- `docs/geo-aeo/BUILD_ROADMAP.md`
- `docs/geo-aeo/AGENT_GUARDRAILS.md`
- `docs/geo-aeo/TEST_PLAN.md`
- `docs/geo-aeo/IMPLEMENTATION_STATUS.md`

## Tests/Checks Run

| Command | Result | Notes |
| ------- | ------ | ----- |
| TBD     | TBD    | TBD   |

## Test Results

TBD.

## Known Issues

TBD.

## Deviations

TBD.

## Security Notes

- Real answer-engine calls disabled by default.
- Google AI Overviews manual/mock first.
- No client-facing drafts.
- No scraping.
- No paid API required.

## Production Readiness Progress

| Area             | Status      |
| ---------------- | ----------- |
| Docs             | Not started |
| Env flags        | Not started |
| Data model       | Not started |
| Services/API     | Not started |
| Adapters         | Not started |
| AI tasks         | Not started |
| Admin UI         | Not started |
| Approval         | Not started |
| Reports/exports  | Not started |
| Client dashboard | Not started |
| Security tests   | Not started |

## Commit-Style History

```txt
geo-aeo-0: document geo aeo feature scope
```
