# Conventions

- Keep launch/readiness language honest: production launch remains no-go until evidence and approvals exist; do not convert historical generated completion notes into release sign-off.
- Follow repo authority docs before changing status, release, env, security, roadmap, architecture, or GEO/AEO scope: `ROADMAP_STATUS.md`, `BUILD_ROADMAP.md`, `ARCHITECTURE.md`, `docs/ENV.md`, `docs/SECURITY.md`, `docs/LAUNCH_READINESS.md`, and `docs/geo-aeo/*` as relevant.
- Preserve mock/manual-first provider behavior unless explicit feature flags, real credentials, and test evidence justify live-provider assumptions.
- Generated surfaces require discipline: route/OpenAPI drift, Orval-generated React client, and generated Zod contracts must stay in sync when API shapes change.
- Express routes live under `artifacts/api-server/src/routes`; shared service/domain logic should move to `artifacts/api-server/src/lib` or `lib/shared` when reused.
- Shared GEO/AEO scoring, schemas, env guards, CSV, AI task, and answer-engine adapter contracts belong under `lib/shared/src/geo-aeo`.
- DB schema changes go through `lib/db/src/schema/*` plus Drizzle migration artifacts; seed logic currently includes `lib/db/scripts/seed-geo-aeo-demo.mjs`.
- Frontend follows existing page/layout/component structure in `artifacts/rankmap/src`; reuse shadcn/Radix-style components from `components/ui` and existing layout conventions.
- ESLint treats `console` as warning except allowed frontend/config/script contexts; root lint uses `--max-warnings 0`, so warnings fail the gate.
- Avoid committing secrets; `.env.example` is placeholder-only and `docs/ENV.md` is the env reference.
- Keep platform/package security overrides in `pnpm-workspace.yaml` intact unless deliberately updating dependency policy.