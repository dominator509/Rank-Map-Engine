# Data And Contracts Core

- DB package: `lib/db` (`@workspace/db`) exports root and schema modules. Schema files live in `src/schema`; migrations and snapshots live under `drizzle`.
- Drizzle commands: package scripts `generate`, `migrate`, `seed`, `push`, `push-force`; root scripts proxy `db:generate`, `db:migrate`, and `db:seed`.
- GEO/AEO demo seed entrypoint: `lib/db/scripts/seed-geo-aeo-demo.mjs`.
- Shared package: `lib/shared` exports root plus `./geo-aeo` and `./geo-aeo/scoring`; keep reusable scoring/schemas/adapters here instead of duplicating API/frontend logic.
- API spec package: `lib/api-spec`; OpenAPI source is `openapi.yaml`, Orval config is `orval.config.ts`, codegen script runs Orval then root `typecheck:libs`.
- Generated API Zod contracts: `lib/api-zod/src/generated/api.ts`.
- Generated React client: `lib/api-client-react/src/generated/*`; package also has `src/custom-fetch.ts` and root `src/index.ts`.
- Route/OpenAPI/generated-client drift is a first-class risk; run `api:route-drift:check` for API shape changes and do not hand-edit generated client/contract files unless generation is unavailable and the exception is documented.