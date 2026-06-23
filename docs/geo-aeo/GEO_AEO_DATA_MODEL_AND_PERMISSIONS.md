# GEO/AEO Data Model and Permissions Specification

This specification is ORM-neutral. Adapt naming and relationship syntax to the existing RankMap repository.

## 1. Design Principles

- Additive migrations only unless explicitly approved.
- Tenant-scoped by organization/client/project.
- Soft-delete where existing repo uses soft-delete.
- Created/updated timestamps on all primary entities.
- No plaintext secrets.
- No unscoped queries.
- Audit sensitive mutations.
- Client-facing queries return approved data only.

## 2. Enums / Constants

### Project Type

```txt
SEO_CONTENT_STRATEGY
GEO_AEO_AUDIT
HYBRID_SEO_GEO
```

### Audit Status

```txt
DRAFT
SETUP_IN_PROGRESS
PROMPTS_READY
SNAPSHOTS_IMPORTED
ANALYSIS_READY
REVIEW_IN_PROGRESS
APPROVED
DELIVERED
MONITORING
ARCHIVED
```

### AI Engine

```txt
CHATGPT
GEMINI
PERPLEXITY
GOOGLE_AI_OVERVIEWS
OTHER
```

### Engine Mode

```txt
CONSUMER_MANUAL
API_SIMULATION
OFFICIAL_API
MOCK
UNKNOWN
```

### Capture Method

```txt
MANUAL_PASTE
CSV_IMPORT
MOCK_ADAPTER
API_ADAPTER
```

### Prompt Intent

```txt
LOCAL_COMMERCIAL
SERVICE_BUYER
COMPARISON
INFORMATIONAL
FAQ
BRAND
PROBLEM_SOLUTION
PRODUCT_CATEGORY
UNKNOWN
```

### Visibility Status

```txt
NOT_TESTED
MISSING
MENTIONED
CITED
COMPETITOR_MENTIONED
COMPETITOR_CITED
INACCURATE
MIXED
```

### Finding Type

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

### Finding Severity

```txt
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

### Action Category

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

### Approval Status

Use existing approval status enum if available. Otherwise:

```txt
DRAFT
PENDING_REVIEW
APPROVED
REJECTED
NEEDS_REVISION
```

## 3. Tables / Models

### GeoAeoAudit

```txt
id
organizationId
clientId
projectId
auditName
status
targetEnginesJson
targetLocation
targetAudience
businessFactsJson
competitorSummaryJson
visibilityScore
visibilityLabel
summary
approvalStatus
approvedAt
approvedById
createdById
updatedById
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
clientId
projectId
status
approvalStatus
createdAt
```

### GeoAeoPromptSet

```txt
id
organizationId
auditId
name
description
status
createdById
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
status
```

### GeoAeoPrompt

```txt
id
organizationId
auditId
promptSetId
promptText
normalizedPrompt
intent
funnelStage
serviceOrProduct
location
priority
status
notes
createdById
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
promptSetId
intent
priority
status
normalizedPrompt
```

Recommended uniqueness:

```txt
organizationId + auditId + normalizedPrompt
```

### GeoAeoPromptVariant

```txt
id
organizationId
promptId
variantText
normalizedVariant
variantType
status
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
promptId
status
```

### GeoAeoCompetitor

```txt
id
organizationId
auditId
name
websiteUrl
aliasesJson
notes
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
name
```

### GeoAeoAnswerSnapshot

```txt
id
organizationId
auditId
promptId
promptVariantId
engine
engineMode
captureMethod
answerText
answerHash
locationContext
rawCitationText
clientMentioned
clientCited
sentiment
accuracyRiskScore
analysisStatus
approvalStatus
capturedAt
createdById
approvedAt
approvedById
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
promptId
engine
captureMethod
analysisStatus
approvalStatus
capturedAt
```

### GeoAeoMention

```txt
id
organizationId
auditId
snapshotId
mentionedEntityType
mentionedEntityName
isClient
isCompetitor
competitorId
position
sentiment
evidenceSnippet
confidenceScore
createdAt
```

Indexes:

```txt
organizationId
auditId
snapshotId
isClient
isCompetitor
competitorId
```

### GeoAeoCitation

```txt
id
organizationId
auditId
snapshotId
url
sourceName
sourceType
isClientOwned
isCompetitorOwned
competitorId
authorityEstimate
notes
createdAt
```

Indexes:

```txt
organizationId
auditId
snapshotId
sourceType
isClientOwned
isCompetitorOwned
competitorId
```

### GeoAeoVisibilityScore

```txt
id
organizationId
auditId
score
label
inputsJson
explanationsJson
isManualOverride
overrideReason
overriddenById
createdAt
```

Indexes:

```txt
organizationId
auditId
createdAt
isManualOverride
```

### GeoAeoFinding

```txt
id
organizationId
auditId
findingType
severity
title
description
evidenceJson
recommendation
status
approvalStatus
approvedAt
approvedById
createdById
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
findingType
severity
status
approvalStatus
```

### GeoAeoSourceRecommendation

```txt
id
organizationId
auditId
sourceName
sourceUrl
sourceType
reason
priority
status
approvalStatus
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
sourceType
priority
status
approvalStatus
```

### GeoAeoSchemaFinding

```txt
id
organizationId
auditId
pageUrl
schemaType
issueType
severity
recommendation
status
approvalStatus
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
schemaType
severity
status
approvalStatus
```

### GeoAeoActionPlan

```txt
id
organizationId
auditId
name
timeHorizonDays
summary
status
approvalStatus
approvedAt
approvedById
createdById
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
status
approvalStatus
```

### GeoAeoActionItem

```txt
id
organizationId
auditId
actionPlanId
relatedFindingId
relatedPromptId
title
description
category
priority
weekNumber
ownerRole
status
approvalStatus
dueDate
assignedToId
createdAt
updatedAt
deletedAt
```

Indexes:

```txt
organizationId
auditId
actionPlanId
category
priority
weekNumber
status
approvalStatus
assignedToId
```

## 4. Permission Set

Add these only if equivalent existing permissions do not already cover the behavior.

```txt
geoAeo.view
geoAeo.manageAudits
geoAeo.managePrompts
geoAeo.importSnapshots
geoAeo.runAnalysis
geoAeo.overrideScores
geoAeo.approveFindings
geoAeo.approveReports
geoAeo.exportReports
geoAeo.viewClientDashboard
geoAeo.manageMonitoring
```

## 5. Suggested Role Mapping

### Super Admin

All GEO/AEO permissions.

### Operator

All operational permissions except tenant/system-wide management if repo separates those.

### Agency Admin

Manage audits/prompts/snapshots/reports for agency-scoped clients.

### Client Owner

View approved client dashboard and approved reports. Download only if license allows.

### Client Viewer

View approved dashboard data. Download only if permission/license allows.

### Writer

View assigned approved action items/briefs only.

### Editor

View/edit assigned approved action items/briefs only; no billing or integration permissions.

## 6. Audit Events

Use existing audit log system. Suggested event names:

```txt
geo_aeo.audit.created
geo_aeo.audit.updated
geo_aeo.audit.deleted
geo_aeo.prompt.created
geo_aeo.prompt.imported
geo_aeo.snapshot.created
geo_aeo.snapshot.imported
geo_aeo.analysis.started
geo_aeo.analysis.completed
geo_aeo.analysis.failed
geo_aeo.score.calculated
geo_aeo.score.overridden
geo_aeo.finding.created
geo_aeo.finding.updated
geo_aeo.finding.approved
geo_aeo.action_plan.generated
geo_aeo.action_item.updated
geo_aeo.report.generated
geo_aeo.report.approved
geo_aeo.report.exported
geo_aeo.client_access.granted
geo_aeo.client_access.revoked
```

## 7. Seed Data

Seed repeatably:

- Demo GEO/AEO audit.
- 4 target engines.
- 8–12 demo prompts.
- 2–3 competitors.
- Mock snapshots.
- Mock mentions/citations.
- One calculated visibility score.
- A few findings.
- A 30-day action plan.

No production secrets.

## 8. Query Rules

Every query must include tenant scope.

Bad:

```txt
find audit by id only
```

Good:

```txt
find audit by id + organizationId + user access scope
```

Client-facing queries must also filter approval/license:

```txt
approvalStatus = APPROVED
license allows view/download
```
