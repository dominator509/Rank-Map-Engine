# API Core

- API package: `artifacts/api-server` (`@workspace/api-server`), Express 5 ESM TypeScript.
- Entry points: `src/index.ts` starts server; `src/app.ts` builds/configures the Express app.
- Route modules live in `src/routes`; route index composes implemented operations across auth, tenants, analytics, audit, clients/projects, keywords/clusters/briefs/topic maps, integrations, billing, webhooks, reports, teams, notifications, GEO/AEO, etc.
- Middleware: `src/middlewares/auth.ts` handles auth/session boundaries; tests include auth/security coverage under middleware and app tests.
- Server-side domain/service helpers live in `src/lib`: AI/provider adapters, audit, API key scopes, geo-aeo service/access, integration credentials, keyword adapters, logger, scoring, sessions, webhook emitter.
- API package build uses `node ./build.mjs`; start uses `node --enable-source-maps ./dist/index.mjs`.
- For API behavior changes, update route tests or service tests near touched files; consider `api.e2e`, boundary, concurrency, rate-limit, and error-boundary tests when shared app behavior changes.
- When route inputs/outputs change, update OpenAPI/generated clients/contracts and run route-drift checks; see `mem:task_completion`.