# RankMap GEO/AEO Build Roadmap

This roadmap is a product-expansion addendum to `BUILD_ROADMAP.md`. It must not reorder or weaken the core RankMap launch-readiness gates.

## G0 - Discovery, Scope Lock, and Docs

- Read the authority docs and live repo patterns.
- Create canonical GEO/AEO docs.
- Record the implementation discovery note and first checkpoint status.

## G1 - Feature Flags and Environment Validation

- Add fake-placeholder-only `.env.example` flags.
- Add validation for mock/manual defaults and real-provider guardrails.
- Keep real answer-engine calls disabled by default.

## G2 - Shared Domain Constants, Schemas, and Scoring

- Add GEO/AEO constants and Zod schemas.
- Add the one shared AI Visibility Score formula.
- Add focused unit tests for labels, clamping, normalization, and env validation.

## G3 - Database Model and Migration

- Add additive Drizzle tables for audits, engines, prompts, variants, snapshots, mentions, citations, competitors, scores, findings, recommendations, schema findings, action plans, and action items.
- Include tenant/client/project/user scoping fields and lookup indexes.
- Do not store secrets or provider credentials.

## G4 - RBAC, Tenant Access, and Audit Events

- Add GEO/AEO permissions or route role mappings using existing helpers.
- Add tenant-scoped access helpers.
- Audit sensitive actions: import, analysis, score override, approval, delete, report export.

## G5 - Services and Thin API Routes

- Add service-layer business logic and route modules under the existing Express router.
- Enforce auth, RBAC, tenant scoping, Zod validation, rate limits, and consistent error shapes.

## G6 - Manual Prompt and Snapshot Workflow

- Support manual prompt entry, CSV prompt import, manual answer snapshots, CSV snapshot import, and CSV formula injection neutralization.
- Keep the workflow complete without paid APIs.

## G7 - Answer-Engine Adapter Registry

- Add `manual_snapshot`, `csv_snapshot`, `mock_answer_engine`, `chatgpt_manual`, `gemini_manual_or_api_scaffold`, `perplexity_api_scaffold`, and `google_ai_overviews_manual`.
- No feature service may call answer engines directly.

## G8 - AI Task Registry Additions

- Add GEO/AEO task definitions with prompt templates, output schemas, deterministic mock outputs, validation, task run logs, and approval behavior.

## G9 - Findings, Scores, and Action Plans

- Generate mentions, citations, source gaps, entity clarity findings, schema findings, AI-citable page recommendations, visibility scores, and a 30-day action plan.
- Manual overrides require permission, reason, and audit log entry.

## G10 - Admin UI, Approval, Client UI, and Reports

- Add admin audit workflow screens using the existing app shell.
- Hide drafts from clients.
- Add Markdown/CSV/PDF reports through existing report/export permissions.

## G11 - Hardening and Smoke

- Add route, tenant, RBAC, adapter, report, export, and client-visibility tests.
- Update implementation status and known limitations after every block.
