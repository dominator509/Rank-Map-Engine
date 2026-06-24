export const GEO_AEO_ENGINES = [
  "chatgpt",
  "gemini",
  "perplexity",
  "google_ai_overviews",
  "other",
] as const;

export type GeoAeoEngine = (typeof GEO_AEO_ENGINES)[number];

export const GEO_AEO_CAPTURE_METHODS = [
  "manual_paste",
  "csv_import",
  "mock_adapter",
  "api_adapter",
] as const;

export type GeoAeoCaptureMethod = (typeof GEO_AEO_CAPTURE_METHODS)[number];

export const GEO_AEO_FINDING_TYPES = [
  "brand_not_mentioned",
  "brand_not_cited",
  "competitor_dominates",
  "source_gap",
  "entity_clarity_gap",
  "schema_gap",
  "faq_gap",
  "service_page_gap",
  "location_page_gap",
  "comparison_page_gap",
  "accuracy_issue",
  "sentiment_issue",
  "proof_trust_gap",
] as const;

export type GeoAeoFindingType = (typeof GEO_AEO_FINDING_TYPES)[number];

export const GEO_AEO_ACTION_CATEGORIES = [
  "entity_clarity",
  "website_content",
  "faq_schema",
  "service_page",
  "location_page",
  "source_citation",
  "review_proof",
  "competitor_gap",
  "measurement",
  "manual_review",
] as const;

export type GeoAeoActionCategory = (typeof GEO_AEO_ACTION_CATEGORIES)[number];

export const GEO_AEO_SCORE_LABELS = [
  "AI Visibility Leader",
  "Strong AI Presence",
  "Emerging AI Presence",
  "At Risk",
  "Invisible / Competitor-Owned",
] as const;

export type GeoAeoScoreLabel = (typeof GEO_AEO_SCORE_LABELS)[number];

export const GEO_AEO_MONITORING_CADENCES = ["none", "monthly", "quarterly"] as const;

export type GeoAeoMonitoringCadence = (typeof GEO_AEO_MONITORING_CADENCES)[number];

export const GEO_AEO_PERMISSIONS = [
  "geoAeo.view",
  "geoAeo.manageAudits",
  "geoAeo.managePrompts",
  "geoAeo.importSnapshots",
  "geoAeo.runAnalysis",
  "geoAeo.overrideScores",
  "geoAeo.approveFindings",
  "geoAeo.approveReports",
  "geoAeo.exportReports",
  "geoAeo.viewClientDashboard",
  "geoAeo.manageMonitoring",
] as const;

export type GeoAeoPermission = (typeof GEO_AEO_PERMISSIONS)[number];

export const GEO_AEO_AUDIT_EVENTS = [
  "geo_aeo.audit.created",
  "geo_aeo.audit.updated",
  "geo_aeo.audit.approved",
  "geo_aeo.audit.deleted",
  "geo_aeo.prompt.created",
  "geo_aeo.prompt.imported",
  "geo_aeo.snapshot.created",
  "geo_aeo.snapshot.updated",
  "geo_aeo.snapshot.imported",
  "geo_aeo.competitor.created",
  "geo_aeo.competitor.updated",
  "geo_aeo.citation.created",
  "geo_aeo.citation.deleted",
  "geo_aeo.analysis.started",
  "geo_aeo.analysis.completed",
  "geo_aeo.analysis.failed",
  "geo_aeo.score.calculated",
  "geo_aeo.score.overridden",
  "geo_aeo.finding.created",
  "geo_aeo.finding.updated",
  "geo_aeo.finding.approved",
  "geo_aeo.source_recommendation.created",
  "geo_aeo.source_recommendation.updated",
  "geo_aeo.schema_finding.created",
  "geo_aeo.schema_finding.updated",
  "geo_aeo.action_plan.generated",
  "geo_aeo.action_item.updated",
  "geo_aeo.report.generated",
  "geo_aeo.report.approved",
  "geo_aeo.report.exported",
  "geo_aeo.monitoring_run.created",
  "geo_aeo.monitoring_run.updated",
  "geo_aeo.monitoring_run.approved",
  "geo_aeo.client_access.granted",
  "geo_aeo.client_access.revoked",
] as const;

export type GeoAeoAuditEvent = (typeof GEO_AEO_AUDIT_EVENTS)[number];
