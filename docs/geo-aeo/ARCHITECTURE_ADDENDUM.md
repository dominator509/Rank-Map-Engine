# RankMap GEO/AEO Architecture Addendum

This addendum extends the existing RankMap architecture. It does not replace the SEO/content strategy workflow, auth/session model, tenant isolation model, RBAC middleware, AI task runner, integration adapter registry, or report/export surface.

## Module Objective

RankMap GEO/AEO Audit helps operators assess where a client is found, cited, ignored, or misrepresented in AI answer surfaces such as ChatGPT, Gemini, Perplexity, and Google AI Overviews. The module must produce approved, client-safe findings, source gaps, entity clarity recommendations, FAQ/schema fixes, AI-citable page opportunities, and a 30-day AI visibility action plan.

## Repo-Aligned Architecture

- Frontend: React/Vite app under `artifacts/rankmap/src`, routed with Wouter inside the existing app shell.
- Backend: Express 5 API under `artifacts/api-server/src/routes`, with thin route modules registered from `routes/index.ts`.
- Database: PostgreSQL with Drizzle schemas under `lib/db/src/schema` and generated migrations under `lib/db/drizzle`.
- Validation: Zod schemas are already standard for route inputs and Drizzle insert schemas.
- Auth: session-based auth with optional scoped API key authentication in `middlewares/auth.ts`.
- RBAC: server-side `requireAuth` and `requireRole` middleware; client role checks are display-only.
- Tenant isolation: every tenant-owned query must include the session tenant guard.
- Audit logs: sensitive mutations use `audit()` from `artifacts/api-server/src/lib/audit.ts`.
- AI: existing tasks use `aiTasksTable`, mock-first execution, and provider fallback in `artifacts/api-server/src/lib/ai-provider.ts`.
- Integrations: provider registry style exists in `artifacts/api-server/src/lib/keyword-adapters.ts`; GEO/AEO answer-engine adapters should follow that shape and remain manual/mock-first.
- Reports/exports: existing report and export routes are project-scoped; GEO/AEO exports must reuse the same permission and tenant patterns.

## Security Invariants

- No unauthorized scraping of answer engines.
- Google AI Overviews is manual/mock only unless a future approved official integration exists.
- ChatGPT consumer answers are manual/mock only unless an approved official path exists.
- Perplexity and Gemini API paths may be scaffolded but must be disabled by default and never required for tests.
- Pasted snapshots are untrusted input and must never be rendered as raw HTML.
- Citation URLs must not be fetched unless routed through an SSRF-safe fetch layer.
- Client dashboards and exports show approved GEO/AEO outputs only.
- Manual fallback must remain complete enough to fulfill a paid audit without real provider credentials.

## Shared Domain Layer

The first implementation layer lives in `lib/shared/src/geo-aeo/`. It owns domain constants, request/input schemas, environment flag validation, CSV cell neutralization, and the single AI Visibility Score implementation. API and UI layers must import the score from there instead of duplicating the formula.

## Implementation Phases

See `docs/geo-aeo/BUILD_ROADMAP.md` and `docs/geo-aeo/IMPLEMENTATION_STATUS.md` for checkpointed delivery.
