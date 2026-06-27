# RankMap — Architecture Document

> **Source of Truth.** This document canonically describes the RankMap product architecture. All implementation must follow this spec.

---

## 1. Product Overview

**RankMap** is an AI-powered SEO SaaS platform providing:

- Keyword research & intent scoring
- Topical authority mapping & content clustering
- Content strategy roadmaps & briefs
- Client reporting & white-label dashboards
- AI task orchestration with human-approval gates
- Stripe-based licensing with per-seat / agency tiers
- Manual fallback for every AI-powered workflow

**Primary Users**

| Role         | Description                                           |
| ------------ | ----------------------------------------------------- |
| Agency Admin | Manages clients, seats, white-label settings, billing |
| Agency User  | Operates client projects within permission scope      |
| Solo SEO     | Single-tenant user managing their own projects        |
| Client       | Read-only dashboard access (white-labeled)            |
| Super Admin  | Platform operator with cross-tenant access            |

---

## 2. High-Level Modules

```
rankmap/
├── Auth & RBAC           — Session, roles, tenant isolation
├── Client & Project Mgmt — Multi-tenant clients / projects
├── Keyword Engine        — Import, clean, deduplicate, score
├── AI Orchestration      — Task registry, provider registry, mock adapter
├── Content Strategy      — Clustering, topic maps, roadmaps, briefs
├── Reporting             — Exportable PDF/CSV reports, client dashboards
├── Integrations          — Ahrefs, Semrush, DataForSEO adapter registry
├── Licensing             — Stripe plans, seat limits, feature flags
└── Admin                 — Platform-level ops, audit log
```

---

## 3. Entities (Core Data Model)

### Tenant

```
id, name, plan (enum), seats_used, seats_max, white_label_config (jsonb),
stripe_customer_id, stripe_subscription_id, created_at, updated_at
```

### User

```
id, tenant_id (FK), email, password_hash, role (enum), full_name,
avatar_url, last_login_at, created_at, updated_at
```

### Client

```
id, tenant_id (FK), name, domain, industry, logo_url, is_active,
created_at, updated_at
```

### Project

```
id, client_id (FK), tenant_id (FK), name, target_domain, locale,
status (enum), created_at, updated_at
```

### Keyword

```
id, project_id (FK), phrase, search_volume, cpc, kd, intent (enum),
cluster_id (FK nullable), source (enum: manual|csv|ahrefs|semrush),
is_active, raw_score, final_score, created_at, updated_at
```

### KeywordCluster

```
id, project_id (FK), label, pillar_topic, cluster_type (enum),
status (enum: pending|approved|rejected), created_at, updated_at
```

### ContentBrief

```
id, cluster_id (FK), project_id (FK), title, outline (jsonb),
target_word_count, status (enum), assigned_to (FK nullable),
created_at, updated_at
```

### Report

```
id, project_id (FK), type (enum), format (enum: pdf|csv),
generated_at, file_url, created_at
```

### AiTask

```
id, project_id (FK), task_type (enum), provider (enum),
status (enum: queued|running|awaiting_approval|approved|rejected|failed),
input (jsonb), output (jsonb nullable), error (text nullable),
created_by (FK), approved_by (FK nullable), created_at, updated_at
```

### IntegrationCredential

```
id, tenant_id (FK), provider (enum), credentials (encrypted JSON envelope),
is_active, created_at, updated_at
```

---

## 4. Keyword Scoring Model

All keywords receive a **RankMap Score (0–100)**:

```
final_score = weighted_sum(
  volume_score      × 0.30,
  kd_score          × 0.25,   // inverted: lower KD = higher score
  intent_score      × 0.20,
  cpc_score         × 0.15,
  freshness_score   × 0.10
)
```

- Formula is centralized in `artifacts/api-server/src/lib/scoring.ts`
- Configurable weights stored in project settings
- Score is recomputed on any field update

---

## 5. AI Orchestration

### Task Registry

Every AI task type is registered with:

- Input/output Zod schemas
- Provider list (priority order)
- Timeout and retry policy
- Whether human approval is required

### Provider Registry

Each AI provider adapter implements `AIProviderAdapter`:

```typescript
interface AIProviderAdapter {
  name: string;
  execute(task: AiTask): Promise<AiTaskOutput>;
  isAvailable(): Promise<boolean>;
}
```

Providers: `openai`, `anthropic`, `mock` (always available, used in dev/test)

### Human Approval Gate

Tasks with `requires_approval = true` pause at `AWAITING_APPROVAL` state.
Approved/rejected by a user with appropriate role before output is applied.

---

## 6. Integration Adapter Registry

All third-party data integrations implement `DataSourceAdapter`:

```typescript
interface DataSourceAdapter {
  name: string;
  fetchKeywords(config: AdapterConfig): Promise<RawKeyword[]>;
  isConfigured(tenantId: string): Promise<boolean>;
}
```

Adapters: `ahrefs`, `semrush`, `dataforseo`, `csv-upload`, `manual`

---

## 7. Workflow: Keyword Research to Content Brief

```
1. Import         → CSV upload / Ahrefs / Semrush / Manual entry
2. Clean          → Deduplicate, normalize, strip invalid rows
3. Score          → Run centralized scoring formula
4. Cluster (AI)   → AI groups keywords into topical clusters
                     → Human approval gate (approve / reject / re-cluster)
5. Topic Map      → Pillar → cluster → supporting keyword hierarchy
6. Brief (AI)     → AI drafts content briefs per cluster
                     → Human approval gate
7. Roadmap        → Prioritized content calendar
8. Report         → PDF/CSV export, client dashboard delivery
```

---

## 8. Multi-Tenancy & Security

- **Tenant isolation**: Every DB query includes `tenant_id` filter via RLS or app-layer guard
- **RBAC**: Role checked at route middleware layer, not in handlers
- **No cross-tenant data leakage**: enforced in service layer
- **Secrets**: All API keys encrypted at rest (`IntegrationCredential.credentials`)
- **No hardcoded secrets**: enforced via ESLint rule + pre-commit hook
- **Feature flags**: Real integrations gate-flagged (`FEATURE_*` env vars), mock adapters always available

---

## 9. Licensing & Billing (Stripe)

| Plan       | Seats     | Projects  | AI Tasks/mo | White-label  |
| ---------- | --------- | --------- | ----------- | ------------ |
| Solo       | 1         | 3         | 500         | No           |
| Agency     | 5         | 25        | 5,000       | Yes          |
| Enterprise | Unlimited | Unlimited | Unlimited   | Yes + custom |

- Stripe webhooks update `Tenant.plan`, `seats_max`, feature flags
- Metered AI usage tracked in `AiTask` table
- Seat enforcement at user invite time
- **Manual fallback**: All AI workflows have a manual path (CSV upload, copy-paste, manual entry) so the product works without any AI credits

---

## 10. White-Label

Agencies can configure:

- Custom domain (CNAME)
- Logo, colors, app name
- `white_label_config` jsonb on `Tenant`

---

## 11. Reporting

- **Project Summary**: keyword counts by intent/cluster/status
- **Topical Authority Score**: coverage % of cluster map
- **Content Pipeline**: brief status, word count targets
- **Client Dashboard**: filtered, white-labeled read-only view
- **Exports**: PDF (react-pdf or puppeteer), CSV (papaparse)

---

## 12. Stack

| Layer      | Technology                                                   |
| ---------- | ------------------------------------------------------------ |
| Frontend   | React 18 + Vite, Tailwind CSS v4, shadcn/ui, Wouter          |
| Backend    | Express 5 + TypeScript, Pino logging                         |
| Database   | PostgreSQL + Drizzle ORM                                     |
| Validation | Zod v4                                                       |
| Auth       | Session-based (Phase 1+) with RBAC middleware                |
| AI         | OpenAI / Anthropic via adapter registry; mock adapter in dev |
| Payments   | Stripe (Phase 5+)                                            |
| Testing    | Vitest (unit/integration), Playwright (e2e)                  |
| Linting    | ESLint + Prettier                                            |
| Deployment | Replit (dev + production)                                    |

---

## 13. Phase Gating (Feature Flags)

```
FEATURE_AI_CLUSTERING=false       # Real AI clustering (mock by default)
FEATURE_STRIPE_BILLING=false      # Real Stripe (manual plan assignment by default)
FEATURE_AHREFS_IMPORT=false       # Real Ahrefs adapter
FEATURE_SEMRUSH_IMPORT=false      # Real Semrush adapter
FEATURE_DATAFORSEO_IMPORT=false   # Real DataForSEO adapter
FEATURE_WHITE_LABEL=false         # White-label (Phase 6+)
```

---

_Last updated: 2026-05-27 - repo reconciliation against implemented architecture._
