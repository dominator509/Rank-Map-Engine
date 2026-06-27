# RankMap GEO/AEO Audit Build Roadmap

This roadmap is an addendum to the existing RankMap roadmap. It must not replace or reorder the core RankMap roadmap. Implement this feature in the smallest safe increments that match the current repository phase and maturity.

## Phase G0 — Discovery, Scope Lock, and Docs

### Goal

Understand the existing RankMap repo and lock the GEO/AEO feature scope before coding.

### Tasks

1. Read `ARCHITECTURE.md`, `BUILD_ROADMAP.md`, `ROADMAP_STATUS.md`, `SECURITY.md`, and `AGENTS.md`.
2. Inspect package scripts, framework, ORM, auth, RBAC, tenant, AI adapter, report, export, and audit-log patterns.
3. Identify current app phase/maturity.
4. Create/update `docs/geo-aeo/ARCHITECTURE_ADDENDUM.md`.
5. Create/update `docs/geo-aeo/BUILD_ROADMAP.md`.
6. Create/update `docs/geo-aeo/AGENT_GUARDRAILS.md`.
7. Create/update `docs/geo-aeo/TEST_PLAN.md`.
8. Create/update `docs/geo-aeo/IMPLEMENTATION_STATUS.md`.
9. Update `ROADMAP_STATUS.md` with a short entry stating this is a scoped product expansion.

### Acceptance Criteria

- Repo patterns are summarized before implementation.
- Docs exist and align with existing architecture.
- No product code has been changed yet except docs/config discovery if needed.

### Tests / Checks

- Documentation lint if available.
- No build required unless docs tooling exists.

### Commit

`geo-aeo-0: document geo aeo feature scope`

---

## Phase G1 — Feature Flags and Environment Validation

### Goal

Add safe feature flags with real answer-engine calls disabled by default.

### Tasks

1. Add `.env.example` placeholders:
   - `GEO_AEO_ENABLED=true`
   - `MOCK_ANSWER_ENGINE_ENABLED=true`
   - `REAL_ANSWER_ENGINE_CALLS_ENABLED=false`
   - `MANUAL_GEO_AEO_SNAPSHOTS_ENABLED=true`
   - `GOOGLE_AI_OVERVIEWS_MANUAL_ONLY=true`
   - `PERPLEXITY_ENABLED=false`
   - `PERPLEXITY_API_KEY=`
   - `GEMINI_VISIBILITY_ENABLED=false`
   - `CHATGPT_VISIBILITY_MANUAL_ONLY=true`
   - `AI_VISIBILITY_MONTHLY_MONITORING_ENABLED=false`
2. Add validation to the existing env validation module.
3. Ensure production cannot enable real calls without required secrets.
4. Add env validation tests.

### Acceptance Criteria

- Env validation passes in local/mock mode.
- Real answer-engine calls are disabled by default.
- Missing real provider keys fail validation only if corresponding real flags are enabled.

### Tests / Checks

```bash
npm run verify-env
npm run test:unit -- env
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-1: add geo aeo feature flags`

---

## Phase G2 — Shared Domain Constants, Schemas, and Scoring

### Goal

Create central shared domain modules before API/UI implementation.

### Tasks

1. Add shared constants for engines, capture methods, snapshot statuses, finding types, action categories, and labels.
2. Add Zod/repo-standard schemas for:
   - Audit create/update.
   - Prompt create/import.
   - Snapshot create/import.
   - Finding update.
   - Action item update.
   - Score override.
3. Add one centralized AI Visibility Score module.
4. Add score explanation generation.
5. Add score label helper.
6. Add unit tests for normalization, clamping, formula, edge cases, and labels.

### Acceptance Criteria

- No duplicate score formula exists.
- Schemas can be reused by API and UI.
- Score tests pass.

### Tests / Checks

```bash
npm run test:unit -- geo-aeo
npm run test:unit -- scoring
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-2: add shared geo aeo domain and scoring`

---

## Phase G3 — Database Migration and Seed Additions

### Goal

Persist GEO/AEO audits, prompts, snapshots, findings, scores, citations, competitors, and action plans.

### Tasks

1. Add additive migration using existing ORM/migration conventions.
2. Add tenant/project/client scoping fields to every tenant-owned model.
3. Add indexes for organization/client/project/audit/status/engine/prompt.
4. Add soft-delete fields if existing repo uses them.
5. Add seed data for a demo GEO/AEO audit using mock/manual data only.
6. Ensure seed is repeatable and has no secrets.
7. Add migration/seed tests.

### Acceptance Criteria

- Migration applies cleanly from empty DB.
- Migration is non-destructive.
- Seed runs repeatedly without duplicates.
- All GEO/AEO entities are tenant-scoped.
- No credential/plaintext-secret fields exist.

### Tests / Checks

```bash
npm run db:migrate
npm run db:seed
npm run test:migration
npm run test:integration -- db
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-3: add geo aeo data model`

---

## Phase G4 — RBAC, Tenant Helpers, and Audit Logs

### Goal

Protect GEO/AEO routes and actions using existing server-side authorization.

### Tasks

1. Add permissions only if existing permissions are insufficient:
   - `geoAeo.view`
   - `geoAeo.manageAudits`
   - `geoAeo.managePrompts`
   - `geoAeo.importSnapshots`
   - `geoAeo.runAnalysis`
   - `geoAeo.overrideScores`
   - `geoAeo.approveFindings`
   - `geoAeo.approveReports`
   - `geoAeo.exportReports`
   - `geoAeo.viewClientDashboard`
   - `geoAeo.manageMonitoring`
2. Seed permissions/role mappings repeatably.
3. Add service helpers for scoped audit lookup.
4. Add audit log events for:
   - Audit create/update/delete.
   - Prompt import.
   - Snapshot import/manual paste.
   - Analysis run.
   - Score override.
   - Finding/report approval.
   - Export.
   - Client access changes.
5. Add RBAC and tenant isolation tests.

### Acceptance Criteria

- UI hiding is not relied upon for security.
- Client viewer cannot see drafts or other tenants.
- Role escalation is blocked.
- Sensitive actions are audited.

### Tests / Checks

```bash
npm run test:unit -- rbac
npm run test:integration -- geo-aeo-rbac
npm run test:security -- geo-aeo
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-4: protect geo aeo with rbac and audit logs`

---

## Phase G5 — Services and Thin API Routes

### Goal

Create service-layer business logic and API endpoints.

### Tasks

1. Implement `GeoAeoAuditService`.
2. Implement `GeoAeoPromptService`.
3. Implement `GeoAeoSnapshotService`.
4. Implement `GeoAeoAnalysisService` scaffold.
5. Implement `GeoAeoFindingService`.
6. Implement `GeoAeoActionPlanService`.
7. Implement thin API routes/controllers using shared schemas.
8. Add pagination/filtering/sorting where list endpoints need it.
9. Add consistent error shapes.

### Acceptance Criteria

- CRUD works for audits/prompts/snapshots/findings/action plans.
- Every query is tenant-scoped.
- Mutations require permission.
- Routes are thin and services own business logic.

### Tests / Checks

```bash
npm run test:integration -- geo-aeo-api
npm run test:security -- tenant-isolation
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-5: add geo aeo services and api`

---

## Phase G6 — Prompt Entry and CSV Prompt Import

### Goal

Allow admins to create and import AI visibility prompts.

### Tasks

1. Add manual prompt entry service/UI support.
2. Add CSV prompt parser.
3. Add import preview showing valid/invalid/duplicate rows.
4. Normalize prompt text.
5. Preserve original prompt text.
6. Detect duplicates within audit/project.
7. Neutralize CSV formula injection.
8. Add fixture tests.

### Acceptance Criteria

- Manual prompt entry works.
- CSV prompt import works.
- Invalid rows are recoverable.
- Duplicates do not pollute the audit.
- CSV injection is neutralized.

### Tests / Checks

```bash
npm run test:unit -- geo-aeo-imports
npm run test:integration -- geo-aeo-imports
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-6: add prompt entry and import`

---

## Phase G7 — Manual and CSV Answer Snapshot Import

### Goal

Allow admins to capture answer-engine observations without real integrations.

### Tasks

1. Add manual answer snapshot form/service.
2. Add CSV answer snapshot parser.
3. Store engine, prompt, capture method, answer text, citation URLs, and notes.
4. Allow manual marking of brand/competitor mentions and citations.
5. Add import preview and rollback/delete import.
6. Add validation and escaping.
7. Add fixture tests.

### Acceptance Criteria

- Admin can paste ChatGPT/Gemini/Perplexity/Google AIO snapshots manually.
- Admin can import snapshots by CSV.
- Snapshot text is stored safely.
- Failed imports do not leave partial state.

### Tests / Checks

```bash
npm run test:unit -- snapshots
npm run test:integration -- geo-aeo-snapshots
npm run test:security -- csv-injection
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-7: add manual and csv answer snapshots`

---

## Phase G8 — Answer-Engine Adapter Registry

### Goal

Represent manual, mock, and future real answer-engine paths using adapters.

### Tasks

1. Add answer-engine adapter interface.
2. Add registry.
3. Implement manual snapshot adapter.
4. Implement CSV snapshot adapter.
5. Implement deterministic mock answer-engine adapter.
6. Scaffold ChatGPT manual adapter.
7. Scaffold Gemini manual/API adapter.
8. Scaffold Perplexity API adapter behind flags.
9. Scaffold Google AI Overviews manual adapter.
10. Add health checks and normalized errors.
11. Add adapter contract tests.

### Acceptance Criteria

- Feature services use adapter registry only.
- Mock/manual paths work with no API keys.
- Real provider paths are disabled by default.
- No automated test makes paid calls.

### Tests / Checks

```bash
npm run test:adapter-contract -- answer-engine
npm run test:integration -- answer-engine
npm run test:security -- adapter-secrets
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-8: add answer engine adapter registry`

---

## Phase G9 — AI Analysis Task Registry Additions

### Goal

Analyze snapshots through the existing AI task runner.

### Tasks

1. Add prompt templates and output schemas for:
   - Prompt intent classification.
   - Brand mention extraction.
   - Competitor mention extraction.
   - Citation extraction.
   - Accuracy issue detection.
   - Entity clarity assessment.
   - Schema readiness assessment.
   - Source recommendation generation.
   - AI-citable page recommendation generation.
   - 30-day action plan generation.
   - Executive summary/report sections.
2. Add deterministic mock outputs.
3. Store AI task run metadata.
4. Validate outputs before writes.
5. Send failures to visible error/review state.

### Acceptance Criteria

- Every GEO/AEO AI task is registered.
- Mock analysis works with no real AI key.
- Invalid outputs are rejected safely.
- No client-facing output bypasses approval.

### Tests / Checks

```bash
npm run test:unit -- geo-aeo-ai
npm run test:integration -- geo-aeo-ai
npm run test:adapter-contract -- mock-ai
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-9: add geo aeo ai analysis tasks`

---

## Phase G10 — Findings, Scores, Competitor Comparison, and Citation Gaps

### Goal

Generate business-usable audit findings from prompts and snapshots.

### Tasks

1. Calculate AI Visibility Score from snapshots/findings.
2. Generate competitor share-of-answer summary.
3. Generate engine-by-engine visibility matrix.
4. Generate citation/source gap table.
5. Generate entity clarity findings.
6. Generate FAQ/schema findings.
7. Generate AI-citable page recommendations.
8. Allow manual score override with reason and audit log.

### Acceptance Criteria

- Score and label are correct.
- Findings are explainable.
- Manual overrides are permissioned and audited.
- Client cannot see draft findings.

### Tests / Checks

```bash
npm run test:unit -- geo-aeo-scoring
npm run test:integration -- geo-aeo-findings
npm run test:security -- approval
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-10: generate geo aeo findings and scores`

---

## Phase G11 — Admin UI

### Goal

Build a usable admin workflow for running GEO/AEO audits.

### Tasks

1. Add admin audit list.
2. Add new audit wizard.
3. Add audit overview.
4. Add prompt manager.
5. Add snapshot import/manual paste UI.
6. Add prompt visibility matrix.
7. Add competitor/citation gap views.
8. Add schema/FAQ findings view.
9. Add scorecard.
10. Add loading/empty/error/permission/success/manual-fallback states.

### Acceptance Criteria

- Admin can complete setup, prompt entry, snapshot import, analysis review, and findings review.
- UI uses existing design system.
- No server-only code leaks to client bundle.

### Tests / Checks

```bash
npm run test:e2e -- geo-aeo-admin
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-11: add admin geo aeo workflow`

---

## Phase G12 — Approval Workflow Integration

### Goal

Ensure human approval before client visibility or client-facing export.

### Tasks

1. Add GEO/AEO approval item types if needed.
2. Allow approve/edit/regenerate/delete for findings, scores, action plans, and reports.
3. Add audit logs for each action.
4. Ensure regeneration creates a new draft or version, not destructive overwrite of approved manual edits.
5. Add client visibility filters.

### Acceptance Criteria

- Draft findings hidden from clients.
- Admin can approve and edit.
- Regeneration does not destroy approved/manual content.
- All approval actions audited.

### Tests / Checks

```bash
npm run test:integration -- geo-aeo-approval
npm run test:e2e -- geo-aeo-approval
npm run test:security -- client-access
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-12: require approval for geo aeo outputs`

---

## Phase G13 — 30-Day Action Plan and Brief Conversion

### Goal

Turn GEO/AEO findings into implementation work.

### Tasks

1. Generate 30-day action plan from approved or draft findings.
2. Add week 1/2/3/4 grouping.
3. Add manual action item creation/editing.
4. Add action categories and statuses.
5. Allow conversion to content brief/roadmap/proposal item if existing systems support it.
6. Add assignment support if writer/editor module exists.

### Acceptance Criteria

- Action plan is practical and editable.
- Admin can manually create all required action items.
- Action items can be approved for client visibility.

### Tests / Checks

```bash
npm run test:unit -- geo-aeo-action-plan
npm run test:integration -- geo-aeo-action-plan
npm run test:e2e -- geo-aeo-action-plan
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-13: add geo aeo action plans`

---

## Phase G14 — Report Builder and Exports

### Goal

Create client-ready GEO/AEO reports using existing report/export infrastructure.

### Tasks

1. Add report type `GEO_AEO_VISIBILITY_AUDIT`.
2. Add required report sections.
3. Add Markdown export.
4. Add CSV export for prompt matrix/findings/action items.
5. Add PDF export if existing app supports PDF.
6. Add report access controls.
7. Add download audit logs.
8. Add methodology/limitations section.

### Acceptance Criteria

- Report includes all required sections.
- Client-facing report requires approval.
- Exports enforce permissions.
- CSV export neutralizes formula injection.

### Tests / Checks

```bash
npm run test:integration -- geo-aeo-reports
npm run test:e2e -- geo-aeo-reports
npm run test:security -- report-access
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-14: add geo aeo reports and exports`

---

## Phase G15 — Client Dashboard and Licensing

### Goal

Expose approved AI visibility insights to clients based on license tier.

### Tasks

1. Add client AI visibility dashboard route/section.
2. Show scorecard, approved prompt matrix, competitor comparison, action plan, and reports.
3. Enforce license tier server-side.
4. Add upgrade/retainer CTA if existing billing/proposal system supports it.
5. Hide drafts and disallowed downloads.

### Acceptance Criteria

- Client sees plain-English approved insights only.
- License tiers are enforced server-side.
- Download permissions are enforced.

### Tests / Checks

```bash
npm run test:e2e -- geo-aeo-client
npm run test:integration -- geo-aeo-license
npm run test:security -- client-access
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-15: add client ai visibility dashboard`

---

## Phase G16 — Monthly Monitoring Scaffold

### Goal

Support recurring revenue through repeatable monthly audits.

### Tasks

1. Add monitoring cadence fields.
2. Add snapshot batch comparison by month.
3. Add month-over-month score change.
4. Add recurring action plan/report template.
5. Add manual monitoring run creation.
6. Keep automated real engine runs disabled unless explicitly supported.

### Acceptance Criteria

- Admin can manually create monthly monitoring runs.
- Client can see approved monthly progress.
- No real provider required.

### Tests / Checks

```bash
npm run test:integration -- geo-aeo-monitoring
npm run test:e2e -- geo-aeo-monitoring
npm run typecheck
npm run lint
```

### Commit

`geo-aeo-16: add monthly ai visibility monitoring scaffold`

---

## Phase G17 — Security Hardening and QA

### Goal

Verify the feature does not weaken the hardened repo.

### Tasks

1. Run full feature test suite.
2. Run tenant isolation tests.
3. Run RBAC tests.
4. Run CSV injection tests.
5. Run secret leakage tests.
6. Run approval visibility tests.
7. Run build and smoke.
8. Update docs with known limitations.
9. Update implementation status.

### Acceptance Criteria

- Critical tests pass.
- No secret leakage.
- No draft client exposure.
- No cross-tenant access.
- Manual fallback path works.
- Known limitations documented.

### Tests / Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run test:security
npm run test:adapter-contract
npm run build
npm run smoke
```

### Commit

`geo-aeo-17: harden and verify geo aeo module`

---

## Feature Done Criteria

The GEO/AEO module is done when:

- Admin can create a GEO/AEO audit.
- Admin can enter/import prompts.
- Admin can paste/import answer snapshots.
- Manual/mock adapters work.
- AI analysis works through existing AI task runner with validated outputs.
- AI Visibility Score is centralized and tested.
- Competitor comparison works.
- Citation gaps work.
- FAQ/schema/entity recommendations work.
- 30-day action plan works.
- Approval workflow hides drafts from clients.
- Client dashboard shows approved insights.
- Reports export in supported formats.
- Manual fallback can complete a paid audit.
- RBAC and tenant isolation are enforced.
- Sensitive actions are audited.
- Docs and status files are current.
