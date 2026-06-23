# RankMap GEO/AEO Agent Guardrails

## Read First

1. `ARCHITECTURE.md`
2. `BUILD_ROADMAP.md`
3. `ROADMAP_STATUS.md`
4. `docs/SECURITY.md`
5. `AGENTS.md`
6. Existing API, service, database, UI, AI, adapter, report, and export patterns

## Do Not

- Rebuild RankMap.
- Replace the SEO/content strategy workflow.
- Add parallel auth, RBAC, tenant, adapter, AI task, scoring, or report systems.
- Expose draft GEO/AEO findings to clients.
- Auto-publish AI output.
- Scrape ChatGPT, Gemini, Perplexity, or Google AI Overviews.
- Require real provider keys for local development, CI, seed data, or tests.
- Store or log plaintext credentials.
- Render AI or pasted snapshot output as raw HTML.
- Fetch citation URLs without an SSRF-safe fetch layer.

## Must Do

- Keep manual/mock fallback complete.
- Use server-side auth, RBAC, and tenant guards.
- Validate inputs and AI outputs with Zod or existing repo-standard schemas.
- Centralize the AI Visibility Score in the shared GEO/AEO module.
- Neutralize CSV formula injection on imports/exports.
- Audit sensitive actions.
- Update `docs/geo-aeo/IMPLEMENTATION_STATUS.md` before and after each major block.

## Current Delivery Posture

The repo is in Phase 39 launch-readiness reconciliation with external production evidence still pending. GEO/AEO work must be additive and must not imply production launch approval.
