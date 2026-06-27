# Core

- RankMap is a TypeScript pnpm workspace for a white-label SEO/GEO/AEO agency SaaS.
- Treat `README.md`, `ROADMAP_STATUS.md`, `BUILD_ROADMAP.md`, `ARCHITECTURE.md`, and docs under `docs/` as authority before editing roadmap, readiness, launch, security, env, or architecture claims.
- Current product state is launch-readiness reconciliation: implemented surface is broad, but production launch remains gated by hosted staging/load evidence, real-provider smoke evidence, ops approvals, and final go/no-go sign-off.
- GEO/AEO is additive, not a replacement for existing SEO/content workflows. See `docs/geo-aeo/*` plus code in `lib/shared/src/geo-aeo`, `lib/db/src/schema/geo-aeo.ts`, `artifacts/api-server/src/routes/geo-aeo.ts`, and `artifacts/rankmap/src/pages/geo-aeo.tsx`.
- Workspace source map:
  - `artifacts/api-server`: Express 5 API, route handlers, middleware, service libraries, API/security/unit/e2e tests.
  - `artifacts/rankmap`: Vite React client, pages, layout, shadcn/Radix-style UI components.
  - `artifacts/mockup-sandbox`: Vite React sandbox/demo surface.
  - `lib/shared`: shared domain logic and GEO/AEO scoring/schemas/adapters.
  - `lib/db`: Drizzle schema, migrations, DB scripts including GEO/AEO demo seed.
  - `lib/api-spec`: OpenAPI spec and Orval generation config.
  - `lib/api-zod`: generated Zod API contracts.
  - `lib/api-client-react`: generated React Query client and custom fetch.
  - `scripts`: repo automation, smoke/e2e/perf/security/drift checks.
- Serena is configured as TypeScript-only with package roots in `additional_workspace_folders`; use symbolic tools first for source navigation.
- Read more before acting: `mem:tech_stack` for tools/versions, `mem:suggested_commands` for command forms, `mem:conventions` for repo-specific implementation rules, `mem:task_completion` for completion checks, `mem:api/core` for backend routes, `mem:frontend/core` for UI, and `mem:data_and_contracts/core` for DB/OpenAPI/generated contracts.