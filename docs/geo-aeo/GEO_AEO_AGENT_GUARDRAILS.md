# GEO/AEO Agent Guardrails — Anti-Drift, Anti-Deadlock, Anti-Fixation

Use this file to keep Codex focused while building the RankMap GEO/AEO Audit module.

## 1. Mission Lock

The mission is to extend RankMap with a GEO/AEO Audit workflow.

The mission is **not** to:

- Rebuild the app.
- Replace SEO keyword strategy.
- Create a generic AI dashboard.
- Add a web scraper.
- Rewrite auth/RBAC/tenant systems.
- Redesign the whole UI.
- Upgrade the full tech stack.
- Fix every unrelated failing test.

## 2. Source-of-Truth Order

Obey in order:

1. Existing repo code and tests.
2. `ARCHITECTURE.md`.
3. `BUILD_ROADMAP.md`.
4. `ROADMAP_STATUS.md`.
5. `SECURITY.md`.
6. `AGENTS.md`.
7. GEO/AEO docs in `docs/geo-aeo/`.
8. User request.

When uncertain, preserve existing production behavior and security first.

## 3. Implementation Behavior

Before coding a block:

1. State current GEO/AEO phase.
2. State current task.
3. State acceptance criteria.
4. List expected files to change.
5. List tests/checks to run.
6. State rollback plan.

After coding a block:

1. Update `docs/geo-aeo/IMPLEMENTATION_STATUS.md` or `ROADMAP_STATUS.md`.
2. Run focused tests.
3. Fix feature-related failures.
4. Document unrelated failures.
5. Commit if git is available.

## 4. Anti-Deadlock Rules

Do not get stuck indefinitely.

### Two-Attempt Rule

For any non-critical issue:

1. Try the most obvious fix.
2. Try one alternative fix.
3. If still blocked, document the limitation and take a smaller safe path.

Examples:

- If PDF export is brittle, keep Markdown/CSV working and document PDF issue.
- If a real Perplexity path is blocked, keep manual/mock path complete.
- If UI route convention is unclear, copy the nearest existing admin route pattern.
- If an unrelated test fails, document it and run focused feature tests.

### Stop Conditions

Stop and document before proceeding if:

- A migration may destroy existing data.
- A security change could weaken auth/RBAC/tenant isolation.
- A required secret would need to be hardcoded.
- A requested implementation would violate provider terms or require unauthorized scraping.
- Client-facing drafts would be exposed.

### Continue Conditions

Continue with a safe fallback if:

- A real integration is unavailable.
- A paid API key is missing.
- A UI detail is not perfect.
- A non-critical unrelated test fails.
- A future integration can be scaffolded behind a feature flag.

## 5. Anti-Fixation Rules

Avoid over-optimizing early.

- Do not spend excessive time on chart polish before the workflow works.
- Do not add analytics visualizations before core CRUD/import/approval/reporting works.
- Do not add new dependencies unless existing repo tools cannot solve the problem.
- Do not add broad abstractions before two concrete uses exist.
- Do not optimize performance before correctness/security/tests.
- Do not implement real answer-engine calls before manual/mock paths are complete.
- Do not expand into social search, app-store search, Reddit visibility, or brand monitoring unless explicitly requested.

## 6. Anti-Drift Rules

Keep the feature aligned with RankMap.

Do not:

- Duplicate RankMap’s scoring architecture; add one GEO/AEO scoring module only.
- Duplicate report templates outside the report system.
- Duplicate adapter registries outside the adapter architecture.
- Duplicate approval flows outside the approval system.
- Duplicate client dashboard access controls.
- Create a separate database access pattern.
- Create unscoped queries.
- Add client-visible drafts.
- Call provider APIs directly from UI components.
- Store answer snapshots as raw HTML.
- Use marketing claims as guaranteed outcomes.

## 7. Real Integration Guardrails

Manual/mock first.

- Google AI Overviews: manual/mock only unless an approved compliant collection path exists.
- ChatGPT: manual/mock only for consumer UI observations unless approved official path exists.
- Gemini: API can be scaffolded, but clearly label as API simulation where applicable.
- Perplexity: API scaffold behind flags; tests must mock.
- No automated tests may call real paid APIs.

## 8. Security Guardrails

Every route/service must enforce:

- Auth.
- Tenant scope.
- RBAC.
- Input validation.
- Output escaping/redaction.
- Audit logging for sensitive actions.

Every import must protect against:

- CSV formula injection.
- Oversized files.
- Invalid encodings.
- Partial writes on failed import.

Every URL operation must protect against:

- SSRF.
- Unsafe protocols.
- Local/private IP fetches.
- Excessive response sizes.
- Long timeouts.

## 9. Approval Guardrails

Client-facing GEO/AEO output must remain hidden until approved.

Approval applies to:

- Findings.
- Scores.
- Action plans.
- Reports.
- Source recommendations.
- AI-citable page recommendations.
- Monthly monitoring reports.

Regeneration must not destructively overwrite approved manual edits.

## 10. Manual Fallback Guardrails

Manual fallback is core, not optional.

If any automation fails, admin must still be able to:

- Enter prompts.
- Paste snapshots.
- Add citations.
- Mark mentions.
- Add findings.
- Override scores with reason.
- Create action plans.
- Approve/export reports.

## 11. Testing Guardrails

Minimum feature quality gates:

- Scoring tests pass.
- Schemas validate.
- Import tests pass.
- Adapter contract tests pass.
- Tenant isolation tests pass.
- RBAC tests pass.
- Approval/draft hiding tests pass.
- Build passes or non-critical unrelated blockers are documented.

## 12. Status Format

Each implementation status update should include:

```txt
## Current GEO/AEO Phase
## Current Task
## Acceptance Criteria Targeted
## Files Changed
## Tests/Checks Run
## Results
## Security Notes
## Known Issues
## Deviations
## Next Step
## Commit
```

## 13. Final Report Format

When done, provide:

```txt
# GEO/AEO Build Report

## Summary
## Current Status
## Major Features Implemented
## Security/RBAC/Tenant Controls
## Manual Fallback Paths
## AI/Adapter Architecture
## Database Changes
## UI/API Changes
## Reports/Exports
## Tests Run
## Test Results
## Known Limitations
## Deviations
## Files Changed
## Commit History
## Recommended Next Steps
```
