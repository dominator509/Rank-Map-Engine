# Tech Stack

- Runtime/package manager: Node >=20, pnpm workspace pinned by root `packageManager` to `pnpm@10.33.2`; use `corepack pnpm ...` for repo scripts.
- Module format: ESM (`type: module`) across workspace packages.
- Language/build: TypeScript ~5.9; root `tsconfig.json` uses project references for `lib/shared`, `lib/db`, `lib/api-client-react`, and `lib/api-zod`.
- Frontend: React catalog version 19.1.0 in `pnpm-workspace.yaml`, Vite 7.3.5, Tailwind CSS v4, Radix/shadcn-style components, TanStack React Query, wouter, lucide-react, recharts.
- Backend: Express 5 + TypeScript, pino logging, helmet/cors/rate-limit/session/cookie-parser, bcryptjs, nodemailer.
- DB: PostgreSQL + Drizzle ORM/Drizzle Kit; schema under `lib/db/src/schema`, migrations under `lib/db/drizzle`.
- API contract generation: OpenAPI YAML in `lib/api-spec/openapi.yaml`; Orval generates React client into `lib/api-client-react/src/generated` and Zod contracts into `lib/api-zod/src/generated`.
- Validation/domain contracts: Zod, shared domain schemas in `lib/shared`.
- Tests/checks: Vitest 3, Playwright 1.57, axe-playwright, ESLint flat config, Prettier 3.
- Security dependency policy: `pnpm-workspace.yaml` contains overrides/minimumReleaseAge/platform optional-dep exclusions; do not remove these casually during package work.