# GEO/AEO Test Plan

This test plan should be adapted to the existing RankMap test framework and commands.

## 1. Test Categories

- Unit tests.
- Integration tests.
- E2E/smoke tests.
- Adapter contract tests.
- Migration tests.
- Security tests.
- Report/export tests.

No test may require a real paid API key.

## 2. Environment Validation Tests

Verify:

- Mock/manual mode validates without secrets.
- Real answer-engine calls disabled by default.
- Enabling real Perplexity without key fails validation.
- Enabling real calls in production requires expected secrets.
- `.env.example` contains placeholders only.

## 3. Scoring Tests

Target module:

```txt
lib/shared/geo-aeo/scoring.ts
```

Test cases:

1. Perfect inputs produce a clamped score <= 100.
2. Negative/over-100 inputs are normalized/clamped.
3. Accuracy risk subtracts correctly.
4. Missing inputs default safely.
5. Labels match exact boundaries:
   - 100 = AI Visibility Leader.
   - 90 = AI Visibility Leader.
   - 89 = Strong AI Presence.
   - 75 = Strong AI Presence.
   - 74 = Emerging AI Presence.
   - 60 = Emerging AI Presence.
   - 59 = At Risk.
   - 40 = At Risk.
   - 39 = Invisible / Competitor-Owned.
   - 0 = Invisible / Competitor-Owned.
6. Score explanations include each input.
7. Manual override requires permission/reason at service level.

## 4. Schema Tests

Validate:

- Audit create/update input.
- Prompt create input.
- Prompt import rows.
- Snapshot create input.
- Snapshot import rows.
- Finding update input.
- Score override input.
- Action plan/action item input.

Reject:

- Empty prompt text.
- Unsupported engine.
- Oversized answer text.
- Invalid URL fields where URL validation is required.
- Invalid score values.

## 5. CSV Import Tests

Prompt import fixtures:

- Generic prompt CSV.
- Local business prompts.
- Duplicate prompts.
- Invalid/missing prompt rows.
- CSV formula injection rows.

Snapshot import fixtures:

- Valid snapshots for all engines.
- Rows with citation URLs.
- Rows with competitor mentions.
- Duplicate snapshots.
- Oversized answer rows.
- Invalid engine rows.
- CSV formula injection rows.

Assert:

- Preview includes valid/invalid/duplicate counts.
- Commit is transactional.
- Failed import does not create partial rows.
- Dangerous cell values are neutralized on export.

## 6. Adapter Contract Tests

For each adapter:

- Registry key exists.
- Display name exists.
- Feature flag exists.
- Secret fields declared.
- Config schema validates.
- Health check works in test/mock mode.
- `normalizeSnapshot` returns normalized snapshot.
- Errors normalize safely.
- No real network calls.

Adapters:

- Manual snapshot.
- CSV snapshot.
- Mock answer engine.
- ChatGPT manual.
- Gemini manual/API scaffold.
- Perplexity API scaffold.
- Google AI Overviews manual.

## 7. AI Task Tests

For each GEO/AEO AI task:

- Prompt template exists.
- Output schema exists.
- Mock output validates.
- Invalid output is rejected.
- Task run metadata is stored.
- Errors are visible/recoverable.
- Snapshot text is treated as untrusted data.

Tasks:

- Prompt intent classification.
- Brand mention extraction.
- Competitor mention extraction.
- Citation extraction.
- Accuracy issue detection.
- Entity clarity assessment.
- Schema readiness assessment.
- Source recommendations.
- AI-citable page recommendations.
- 30-day action plan.
- Executive summary/report sections.

## 8. Service/API Integration Tests

Test:

- Create audit.
- List audits scoped to organization.
- Update audit.
- Soft-delete/archive audit.
- Create prompt.
- Import prompts.
- Create manual snapshot.
- Import snapshots.
- Run mock analysis.
- Calculate score.
- Create/edit findings.
- Approve findings.
- Generate action plan.
- Generate report.
- Export report.

Assert:

- Auth required.
- Tenant scope enforced.
- RBAC enforced.
- Audit logs created.
- Consistent error shapes.

## 9. Tenant Isolation Tests

Create two organizations with separate users/clients/projects/audits.

Verify:

- User A cannot list User B audits.
- User A cannot access User B prompt/snapshot/finding/report by guessed ID.
- Client viewer cannot access another client’s approved report.
- Writer sees only assigned items where applicable.

## 10. RBAC Tests

Verify:

- Super admin/operator can manage audits.
- Agency admin limited to agency scope.
- Client owner can view approved dashboard only.
- Client viewer cannot import snapshots or approve reports.
- Writer cannot manage billing/integrations or approve findings.
- Score override requires `geoAeo.overrideScores`.
- Export requires `geoAeo.exportReports` and license/download permission.

## 11. Approval Tests

Verify:

- Draft findings hidden from clients.
- Draft action plans hidden from clients.
- Draft reports hidden from clients.
- Approval makes findings visible.
- Regeneration creates a new draft/version instead of overwriting approved manual edits.
- Approval actions audited.

## 12. Report/Export Tests

Verify report includes:

- Executive summary.
- AI visibility scorecard.
- Prompt matrix.
- Engine findings.
- Competitor comparison.
- Citation/source gaps.
- FAQ/schema findings.
- AI-citable page recommendations.
- 30-day action plan.
- Methodology/limitations.

Verify exports:

- Markdown works.
- CSV works and neutralizes formulas.
- PDF works if existing app supports PDF.
- Download permissions enforced.
- Download audit logs created.

## 13. E2E / Smoke Flow

Critical flow:

1. Admin logs in.
2. Admin creates/selects client.
3. Admin creates GEO/AEO audit.
4. Admin adds competitors.
5. Admin imports prompts.
6. Admin pastes/imports snapshots.
7. Admin runs mock AI analysis.
8. Admin reviews visibility score/findings.
9. Admin overrides one score with reason.
10. Admin approves findings.
11. Admin generates 30-day action plan.
12. Admin generates report.
13. Admin exports Markdown/CSV/PDF if supported.
14. Client logs in.
15. Client sees approved AI visibility dashboard.
16. Client cannot see draft/unapproved findings.

## 14. Security Tests

Verify:

- No secrets in client bundle.
- No secrets in logs/errors.
- Snapshot HTML is escaped.
- CSV injection neutralized.
- URL fetch blocked unless SSRF-safe fetch layer is used.
- Real calls cannot run unless explicitly enabled.
- Client downloads require permission/license.
- Rate limits apply to sensitive routes if the repo has rate limiting.

## 15. Suggested Commands

Use existing repo commands. If available:

```bash
npm run verify-env
npm run typecheck
npm run lint
npm run test:unit -- geo-aeo
npm run test:integration -- geo-aeo
npm run test:adapter-contract -- answer-engine
npm run test:security -- geo-aeo
npm run test:e2e -- geo-aeo
npm run build
npm run smoke
```

If these exact commands do not exist, map to the closest existing scripts and document the mapping.
