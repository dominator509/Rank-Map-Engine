# Frontend Core

- Frontend package: `artifacts/rankmap` (`@workspace/rankmap`), Vite + React client.
- App entry: `src/main.tsx`; top-level routing/app composition: `src/App.tsx`.
- Pages live in `src/pages`; current product pages cover dashboard, clients, project detail, auth, billing, competitors, custom fields, analytics, AI tasks, API keys, audit log, webhooks, usage, templates, team, report schedules, rankings, notifications, integrations, GEO/AEO, GDPR, etc.
- Shared layout is under `src/components/layout`; UI primitives are under `src/components/ui` and follow shadcn/Radix-style composition.
- Project workflow tabs are under `src/components/project` (`keywords-tab`, `clusters-tab`, `briefs-tab`, `roadmap-tab`, `reports-tab`, `topic-map-tab`).
- Client API access should prefer generated React Query client from `@workspace/api-client-react` unless an existing local pattern requires otherwise.
- Vite config uses `vite.config.ts`; scripts are `dev`, `build`, `serve`, and `typecheck` within the package.
- For UI changes, keep dense operational SaaS styling consistent; verify text fit/responsive behavior and include browser/Playwright evidence when feasible.