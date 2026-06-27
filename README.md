# RankMap

> AI-powered SEO keyword research, content strategy, and topical authority engine. White-label agency SaaS.

## What is RankMap?

RankMap helps SEO agencies and solo practitioners:

- Import and score keywords from multiple sources (CSV, Ahrefs, Semrush, manual)
- Cluster keywords into topical groups using AI (with human approval)
- Build topical authority maps and prioritized content roadmaps
- Generate AI-assisted content briefs
- Deliver white-labeled client dashboards and exportable reports
- Manage clients and projects across a multi-tenant agency workspace

## Project Status

**Phase 39 - Launch readiness reconciliation** (current)

The product surface is substantially implemented, but launch readiness is still gated on the
evidence tracked in `ROADMAP_STATUS.md`. Treat historical generated "complete" sections as notes,
not as release sign-off.

See [`ROADMAP_STATUS.md`](./ROADMAP_STATUS.md) for live phase tracking.  
See [`BUILD_ROADMAP.md`](./BUILD_ROADMAP.md) for the full execution plan.  
See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the canonical architecture.

## Stack

| Layer           | Technology                                  |
| --------------- | ------------------------------------------- |
| Frontend        | React 19 + Vite, Tailwind CSS v4, shadcn/ui |
| Backend         | Express 5 + TypeScript                      |
| Database        | PostgreSQL + Drizzle ORM                    |
| Validation      | Zod v3                                      |
| Testing         | Vitest + Playwright                         |
| Linting         | ESLint + Prettier                           |
| Package Manager | pnpm (workspace monorepo)                   |

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL (provided by Replit)
- Docker Desktop or another reachable Docker daemon for e2e, smoke, performance, and recovery baselines that start disposable Postgres containers

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment template (fill in real values for local dev)
cp .env.example .env

# Push database schema (dev only)
pnpm --filter @workspace/db run push

# Regenerate API types from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

## Development

```bash
# Type-check all packages
pnpm run typecheck

# Lint all packages
pnpm run lint

# Run tests
pnpm run test

# Format code
pnpm run format
```

Workflows are managed by Replit and start automatically. See the Replit preview pane.

## Environment Variables

See [`docs/ENV.md`](./docs/ENV.md) for the full reference.  
**Never commit `.env`.** Use `.env.example` for placeholders only.

## Security

See [`docs/SECURITY.md`](./docs/SECURITY.md) for the security policy.

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full product and technical architecture.

## Build Roadmap

See [`BUILD_ROADMAP.md`](./BUILD_ROADMAP.md) for the phase-by-phase execution plan.

## License

Proprietary. All rights reserved.
