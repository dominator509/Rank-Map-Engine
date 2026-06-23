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
