# RankMap Architecture Addendum — GEO/AEO Audit Module

## 1. Module Objective

The GEO/AEO Audit module extends RankMap from traditional SEO keyword/content strategy into AI-answer visibility strategy.

Core promise:

> Help a business understand where it is found, cited, ignored, or misrepresented in ChatGPT, Gemini, Perplexity, and Google AI Overviews, then produce a prioritized 30-day action plan to improve AI visibility.

This module must live inside the existing RankMap app, database, auth, RBAC, tenant, approval, export, billing, and adapter systems.

## 2. What This Module Is

GEO/AEO Audit is a structured audit workflow for:

- AI visibility prompt research.
- Prompt variant testing.
- Manual or mock answer snapshot collection.
- Brand/entity mention detection.
- Competitor mention comparison.
- Citation/source extraction.
- Source gap analysis.
- Entity clarity analysis.
- FAQ and schema readiness analysis.
- AI-citable page recommendations.
- 30-day action plan generation.
- Client-ready GEO/AEO audit reports.
- Recurring monthly AI visibility monitoring.

## 3. What This Module Is Not

This module is **not**:

- A separate SaaS app.
- A generic AI chat UI.
- A ChatGPT/Gemini/Perplexity scraper.
- A guaranteed AI ranking tool.
- A guaranteed citation placement tool.
- A full replacement for traditional SEO.
- A full crawler or SERP scraper.
- A fully automated publishing engine.

## 4. User Types

### Admin / Operator

Creates GEO/AEO audits, enters target prompts, imports snapshots, reviews AI-generated findings, approves client-facing output, exports reports, and sells ongoing monitoring or implementation.

### Client Owner / Client Viewer

Views approved AI visibility findings, competitor comparisons, action plans, and reports in plain English according to license tier.

### Agency Admin / White-Label User

Runs GEO/AEO audits across multiple clients and exports branded reports.

### Writer / Editor

Receives approved AI-citable page briefs and action items where assigned.

## 5. Core Workflow

1. Admin creates or opens a client/project.
2. Admin selects `GEO_AEO_AUDIT` or `HYBRID_SEO_GEO` project/audit type.
3. Admin enters business facts:
   - Website.
   - Brand/business name.
   - Niche/category.
   - Target services/products.
   - Target location.
   - Audience.
   - Competitors.
   - Important proof points.
4. Admin creates/imports AI visibility prompts.
5. Admin selects target engines:
   - ChatGPT.
   - Gemini.
   - Perplexity.
   - Google AI Overviews.
6. Admin manually pastes answer snapshots or imports CSV snapshots.
7. Mock/manual answer-engine adapters normalize the snapshot data.
8. AI task runner analyzes snapshots for:
   - Client mentions.
   - Client citations.
   - Competitor mentions.
   - Competitor citations.
   - Citation/source URLs.
   - Sentiment.
   - Accuracy issues.
   - Missing information.
   - Source gaps.
9. System calculates AI Visibility Score.
10. System generates findings and recommendations.
11. System generates a 30-day action plan.
12. Admin reviews, edits, approves, regenerates, deletes, or overrides.
13. Client sees approved findings only.
14. Admin exports PDF, Markdown, and CSV reports.
15. Admin can convert recommendations into content briefs, roadmap items, proposals, or retainer tasks.

## 6. Project Types

Add or support these values using the repo’s existing enum/config style:

```txt
SEO_CONTENT_STRATEGY
GEO_AEO_AUDIT
HYBRID_SEO_GEO
```

If changing the existing `Project` enum is risky, add a `projectType` or `strategyType` add-on table/field through an additive migration.

## 7. Core Entities

Suggested entities, adapted to the repo’s ORM conventions:

### GeoAeoAudit

Stores an audit instance.

Important fields:

- `id`
- `organizationId`
- `clientId`
- `projectId`
- `auditName`
- `status`
- `targetEngines`
- `targetLocation`
- `targetAudience`
- `businessFactsJson`
- `visibilityScore`
- `visibilityLabel`
- `summary`
- `approvedAt`
- `approvedById`
- `createdById`
- `createdAt`
- `updatedAt`
- `deletedAt`

### GeoAeoPromptSet

Stores grouped prompts for an audit.

- `id`
- `organizationId`
- `auditId`
- `name`
- `description`
- `status`
- `createdAt`
- `updatedAt`

### GeoAeoPrompt

Stores target AI-answer questions/prompts.

- `id`
- `organizationId`
- `auditId`
- `promptSetId`
- `promptText`
- `normalizedPrompt`
- `intent`
- `funnelStage`
- `serviceOrProduct`
- `location`
- `priority`
- `status`
- `createdAt`
- `updatedAt`

### GeoAeoPromptVariant

Stores prompt variants for repeatability and sensitivity analysis.

- `id`
- `organizationId`
- `promptId`
- `variantText`
- `variantType`
- `status`
- `createdAt`
- `updatedAt`

### GeoAeoAnswerSnapshot

Stores an observed or imported answer.

- `id`
- `organizationId`
- `auditId`
- `promptId`
- `promptVariantId`
- `engine`
- `engineMode`
- `captureMethod`
- `answerText`
- `answerHash`
- `locationContext`
- `clientMentioned`
- `clientCited`
- `sentiment`
- `accuracyRiskScore`
- `capturedAt`
- `createdById`
- `approvedAt`
- `approvedById`
- `createdAt`
- `updatedAt`

### GeoAeoMention

Stores detected brand or competitor mentions.

- `id`
- `organizationId`
- `snapshotId`
- `auditId`
- `mentionedEntityType`
- `mentionedEntityName`
- `isClient`
- `isCompetitor`
- `position`
- `sentiment`
- `evidenceSnippet`
- `confidenceScore`
- `createdAt`

### GeoAeoCitation

Stores extracted citation/source URLs or source names.

- `id`
- `organizationId`
- `snapshotId`
- `auditId`
- `url`
- `sourceName`
- `sourceType`
- `isClientOwned`
- `isCompetitorOwned`
- `authorityEstimate`
- `notes`
- `createdAt`

### GeoAeoCompetitor

Stores audit competitors and aliases.

- `id`
- `organizationId`
- `auditId`
- `name`
- `websiteUrl`
- `aliasesJson`
- `notes`
- `createdAt`
- `updatedAt`

### GeoAeoVisibilityScore

Stores calculated and overridden scores.

- `id`
- `organizationId`
- `auditId`
- `score`
- `label`
- `inputsJson`
- `explanationsJson`
- `isManualOverride`
- `overrideReason`
- `overriddenById`
- `createdAt`

### GeoAeoFinding

Stores generated findings.

- `id`
- `organizationId`
- `auditId`
- `findingType`
- `severity`
- `title`
- `description`
- `evidenceJson`
- `recommendation`
- `status`
- `approvedAt`
- `approvedById`
- `createdAt`
- `updatedAt`

### GeoAeoSourceRecommendation

Stores recommended source/citation opportunities.

- `id`
- `organizationId`
- `auditId`
- `sourceName`
- `sourceUrl`
- `sourceType`
- `reason`
- `priority`
- `status`
- `createdAt`
- `updatedAt`

### GeoAeoSchemaFinding

Stores FAQ/schema/entity clarity issues.

- `id`
- `organizationId`
- `auditId`
- `pageUrl`
- `schemaType`
- `issueType`
- `severity`
- `recommendation`
- `status`
- `createdAt`
- `updatedAt`

### GeoAeoActionPlan

Stores a generated or manually created action plan.

- `id`
- `organizationId`
- `auditId`
- `name`
- `timeHorizonDays`
- `summary`
- `status`
- `approvedAt`
- `approvedById`
- `createdAt`
- `updatedAt`

### GeoAeoActionItem

Stores specific recommendations.

- `id`
- `organizationId`
- `actionPlanId`
- `auditId`
- `title`
- `description`
- `category`
- `priority`
- `weekNumber`
- `ownerRole`
- `status`
- `relatedFindingId`
- `relatedPromptId`
- `createdAt`
- `updatedAt`

## 8. Engine Types

Supported target engines:

```txt
CHATGPT
GEMINI
PERPLEXITY
GOOGLE_AI_OVERVIEWS
OTHER
```

Supported capture methods:

```txt
MANUAL_PASTE
CSV_IMPORT
MOCK_ADAPTER
API_ADAPTER
```

Supported engine modes:

```txt
CONSUMER_MANUAL
API_SIMULATION
OFFICIAL_API
MOCK
UNKNOWN
```

## 9. AI Visibility Scoring

The scoring formula must live in a single shared module.

```txt
AI Visibility Score =
  (Brand Mention Coverage * 0.20)
+ (Citation Coverage * 0.20)
+ (Prompt Intent Coverage * 0.15)
+ (Competitor Gap Opportunity * 0.15)
+ (Entity Clarity Score * 0.10)
+ (Schema Readiness Score * 0.10)
+ (Source Authority Readiness * 0.10)
- (Accuracy Risk Score * 0.10)
```

All inputs are normalized to `0–100`. Output is clamped to `0–100`.

Labels:

|  Score | Label                        |
| -----: | ---------------------------- |
| 90–100 | AI Visibility Leader         |
|  75–89 | Strong AI Presence           |
|  60–74 | Emerging AI Presence         |
|  40–59 | At Risk                      |
|   0–39 | Invisible / Competitor-Owned |

## 10. Prompt Visibility Matrix

The prompt matrix should compare visibility across engines:

| Prompt                           | ChatGPT | Gemini    | Perplexity       | Google AIO | Winner       | Priority |
| -------------------------------- | ------- | --------- | ---------------- | ---------- | ------------ | -------- |
| Best emergency plumber in Austin | Missing | Mentioned | Competitor cited | Missing    | Competitor A | High     |

Statuses:

```txt
MISSING
MENTIONED
CITED
COMPETITOR_MENTIONED
COMPETITOR_CITED
INACCURATE
NOT_TESTED
```

## 11. Findings Taxonomy

Supported finding types:

```txt
BRAND_NOT_MENTIONED
BRAND_NOT_CITED
COMPETITOR_DOMINATES
SOURCE_GAP
ENTITY_CLARITY_GAP
SCHEMA_GAP
FAQ_GAP
SERVICE_PAGE_GAP
LOCATION_PAGE_GAP
COMPARISON_PAGE_GAP
ACCURACY_ISSUE
SENTIMENT_ISSUE
PROOF_TRUST_GAP
```

Severity:

```txt
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

## 12. Action Plan Categories

```txt
ENTITY_CLARITY
WEBSITE_CONTENT
FAQ_SCHEMA
SERVICE_PAGE
LOCATION_PAGE
SOURCE_CITATION
REVIEW_PROOF
COMPETITOR_GAP
MEASUREMENT
MANUAL_REVIEW
```

## 13. AI Task Architecture

GEO/AEO tasks must use the existing AI task runner and prompt/output schema registries.

Required AI tasks:

- Prompt intent classification.
- Brand mention extraction.
- Competitor mention extraction.
- Citation extraction.
- Accuracy issue detection.
- Entity clarity assessment.
- Schema readiness assessment.
- Source recommendation generation.
- AI-citable page recommendation generation.
- 30-day action plan generation.
- Executive summary generation.
- Report section generation.

All outputs must be validated before storage.

## 14. Adapter Architecture

Create an answer-engine adapter registry separate from, or clearly layered on top of, the AI provider registry.

Required adapters:

- Manual snapshot adapter.
- CSV snapshot adapter.
- Mock answer-engine adapter.
- ChatGPT manual adapter.
- Gemini manual/API scaffold.
- Perplexity API scaffold.
- Google AI Overviews manual adapter.

No feature code should call answer engines directly.

## 15. Reporting Architecture

Use the existing report builder/export system.

New report type:

```txt
GEO_AEO_VISIBILITY_AUDIT
```

Required sections:

1. Executive summary.
2. AI visibility scorecard.
3. Prompt visibility matrix.
4. Engine-by-engine findings.
5. Competitor comparison.
6. Citation/source gaps.
7. Entity clarity findings.
8. FAQ/schema fixes.
9. AI-citable page recommendations.
10. 30-day action plan.
11. Optional retainer/monitoring recommendation.
12. Methodology and limitations.

## 16. Manual Fallback Architecture

Manual fallback is first-class.

The operator must be able to complete the audit with:

- Manual prompt entry.
- CSV prompt import.
- Manual answer snapshot paste.
- CSV answer snapshot import.
- Manual mention/citation editing.
- Manual findings.
- Manual action plan.
- Manual report approval/export.

## 17. Security Requirements

- Auth required for all admin routes.
- Server-side tenant isolation on every query.
- Server-side RBAC on every mutation and export.
- Client routes show approved findings only.
- CSV formula injection neutralized.
- AI outputs escaped and not rendered as raw HTML.
- Snapshot text treated as untrusted input.
- Citation URLs not fetched unless SSRF-safe fetch layer is used.
- Sensitive actions audited.
- No real provider calls unless explicitly enabled by env flags.
- No secrets logged or returned.

## 18. Known Limitations to Document

- AI answer systems are variable and can change between runs.
- Manual snapshots represent a point-in-time observation.
- API outputs may not match consumer UI outputs.
- Google AI Overviews collection is manual/mock first; no scraping.
- RankMap does not guarantee AI recommendations, rankings, traffic, or revenue.
- Citation/source recommendations are strategic recommendations, not guaranteed placements.
