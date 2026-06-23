# RankMap GEO/AEO Codex Implementation Pack

This pack gives Codex GPT-5.5 a thorough, repo-safe prompt and supporting markdown files for adding a GEO/AEO Audit module to an existing hardened RankMap repository.

## Recommended Use

1. Copy the contents of `CODEX_MASTER_PROMPT_GEO_AEO.md` into Codex first.
2. Add the supporting markdown files to the repo under `docs/geo-aeo/`, or ask Codex to create/update those files from the prompt.
3. Tell Codex to begin with **G0 only**: discovery, scope lock, and docs.
4. Review the implementation status before allowing migrations or product code changes.
5. Let Codex proceed phase by phase using checkpoint commits.

## Files

- `CODEX_MASTER_PROMPT_GEO_AEO.md` — paste this into Codex as the main instruction.
- `GEO_AEO_ARCHITECTURE_ADDENDUM.md` — product and technical architecture for the feature.
- `GEO_AEO_BUILD_ROADMAP.md` — phase-by-phase build roadmap.
- `GEO_AEO_AGENT_GUARDRAILS.md` — anti-drift, anti-deadlock, anti-fixation rules.
- `GEO_AEO_DATA_MODEL_AND_PERMISSIONS.md` — ORM-neutral data model and RBAC spec.
- `GEO_AEO_ENV_AND_ADAPTERS.md` — environment flags and answer-engine adapter spec.
- `GEO_AEO_TEST_PLAN.md` — complete test plan.
- `GEO_AEO_ROADMAP_STATUS_TEMPLATE.md` — status template for tracking progress.

## Suggested Repo Placement

```txt
docs/geo-aeo/
  ARCHITECTURE_ADDENDUM.md
  BUILD_ROADMAP.md
  AGENT_GUARDRAILS.md
  DATA_MODEL_AND_PERMISSIONS.md
  ENV_AND_ADAPTERS.md
  TEST_PLAN.md
  IMPLEMENTATION_STATUS.md
```

## Important Guardrails

- Do not rebuild RankMap.
- Do not scrape ChatGPT, Gemini, Perplexity, or Google AI Overviews.
- Manual/mock snapshot workflows come first.
- Real provider/API paths must be feature-flagged.
- No real paid API key should be required for tests.
- No client-facing GEO/AEO output should appear before admin approval.
- Tenant isolation, RBAC, audit logs, and report permissions must remain server-enforced.
