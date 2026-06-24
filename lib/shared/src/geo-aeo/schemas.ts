import { z } from "zod";
import {
  GEO_AEO_ACTION_CATEGORIES,
  GEO_AEO_CAPTURE_METHODS,
  GEO_AEO_ENGINES,
  GEO_AEO_FINDING_TYPES,
  GEO_AEO_MONITORING_CADENCES,
} from "./constants.js";
import type { GeoAeoScoreInputs } from "./scoring.js";

export const geoAeoEngineSchema = z.enum(GEO_AEO_ENGINES);
export const geoAeoCaptureMethodSchema = z.enum(GEO_AEO_CAPTURE_METHODS);
export const geoAeoFindingTypeSchema = z.enum(GEO_AEO_FINDING_TYPES);
export const geoAeoActionCategorySchema = z.enum(GEO_AEO_ACTION_CATEGORIES);
export const geoAeoMonitoringCadenceSchema = z.enum(GEO_AEO_MONITORING_CADENCES);

export const geoAeoAuditCreateSchema = z.object({
  clientId: z.number().int().positive(),
  projectId: z.number().int().positive().optional(),
  auditName: z.string().trim().min(1).max(160),
  websiteUrl: z.string().url(),
  niche: z.string().trim().min(1).max(160),
  servicesOrProducts: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  targetLocation: z.string().trim().max(160).optional(),
  targetAudience: z.string().trim().max(500).optional(),
  businessFacts: z.record(z.string(), z.unknown()).default({}),
  targetEngines: z.array(geoAeoEngineSchema).min(1),
  monitoringEnabled: z.boolean().default(false),
  monitoringCadence: geoAeoMonitoringCadenceSchema.default("none"),
  nextMonitoringRunAt: z.string().datetime().optional(),
});

export const geoAeoAuditUpdateSchema = z.object({
  auditName: z.string().trim().min(1).max(160).optional(),
  websiteUrl: z.string().url().optional(),
  niche: z.string().trim().min(1).max(160).optional(),
  servicesOrProducts: z.array(z.string().trim().min(1).max(160)).min(1).max(100).optional(),
  targetLocation: z.string().trim().max(160).nullable().optional(),
  targetAudience: z.string().trim().max(500).nullable().optional(),
  businessFacts: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "in_review", "approved", "archived"]).optional(),
  summary: z.string().trim().max(5000).nullable().optional(),
  monitoringEnabled: z.boolean().optional(),
  monitoringCadence: geoAeoMonitoringCadenceSchema.optional(),
  nextMonitoringRunAt: z.string().datetime().nullable().optional(),
});

export const geoAeoPromptCreateSchema = z.object({
  auditId: z.number().int().positive(),
  promptSetId: z.number().int().positive().optional(),
  promptText: z.string().trim().min(1).max(2000),
  intent: z.string().trim().max(120).optional(),
  funnelStage: z.string().trim().max(120).optional(),
  serviceOrProduct: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  priority: z.number().int().min(0).max(100).default(50),
});

export const geoAeoPromptImportCsvSchema = z.object({
  csvText: z.string().min(1).max(500_000),
});

export const geoAeoSnapshotCreateSchema = z.object({
  auditId: z.number().int().positive(),
  promptId: z.number().int().positive(),
  promptVariantId: z.number().int().positive().optional(),
  engine: geoAeoEngineSchema,
  captureMethod: geoAeoCaptureMethodSchema,
  answerText: z.string().min(1).max(100_000),
  capturedAt: z.string().datetime().optional(),
  locationContext: z.string().trim().max(240).optional(),
});

export const geoAeoSnapshotImportCsvSchema = z.object({
  csvText: z.string().min(1).max(1_000_000),
});

export const geoAeoSnapshotUpdateSchema = z.object({
  clientMentioned: z.boolean().optional(),
  clientCited: z.boolean().optional(),
  sentiment: z.string().trim().max(80).nullable().optional(),
  accuracyRiskScore: z.number().min(0).max(100).nullable().optional(),
  locationContext: z.string().trim().max(240).nullable().optional(),
});

export const geoAeoCompetitorCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  websiteUrl: z.string().url().optional(),
  aliases: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  notes: z.string().trim().max(2000).optional(),
});

export const geoAeoCompetitorUpdateSchema = geoAeoCompetitorCreateSchema.partial().extend({
  aliases: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
});

export const geoAeoCitationCreateSchema = z.object({
  snapshotId: z.number().int().positive().optional(),
  url: z.string().url().optional(),
  sourceName: z.string().trim().max(200).optional(),
  sourceType: z.string().trim().max(120).optional(),
  isClientOwned: z.boolean().default(false),
  isCompetitorOwned: z.boolean().default(false),
  authorityEstimate: z.number().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const geoAeoSourceRecommendationCreateSchema = z.object({
  sourceName: z.string().trim().min(1).max(200),
  sourceUrl: z.string().url().optional(),
  sourceType: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(2000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["draft", "approved", "rejected", "done"]).default("draft"),
});

export const geoAeoSourceRecommendationUpdateSchema =
  geoAeoSourceRecommendationCreateSchema.partial();

export const geoAeoSchemaFindingCreateSchema = z.object({
  pageUrl: z.string().url().optional(),
  schemaType: z.string().trim().max(120).optional(),
  issueType: z.string().trim().min(1).max(200),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  recommendation: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "approved", "rejected", "done"]).default("draft"),
});

export const geoAeoSchemaFindingUpdateSchema = geoAeoSchemaFindingCreateSchema.partial();

export const geoAeoFindingUpdateSchema = z.object({
  findingType: geoAeoFindingTypeSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  recommendation: z.string().trim().max(5000).optional(),
  status: z.enum(["draft", "needs_review", "approved", "rejected", "deleted"]).optional(),
});

export const geoAeoActionItemUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  category: geoAeoActionCategorySchema.optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  weekNumber: z.number().int().min(1).max(4).optional(),
  status: z.enum(["draft", "approved", "in_progress", "done", "deferred"]).optional(),
});

export const geoAeoActionPlanGenerateSchema = z.object({
  name: z.string().trim().min(1).max(200).default("30-day AI visibility action plan"),
  timeHorizonDays: z.number().int().min(7).max(90).default(30),
});

export const geoAeoReportGenerateSchema = z.object({
  format: z.enum(["markdown", "csv", "json", "pdf"]).default("markdown"),
});

export const geoAeoReportExportSchema = z.object({
  format: z.enum(["markdown", "csv", "json", "pdf"]).default("markdown"),
});

const geoAeoMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

export const geoAeoMonitoringRunCreateSchema = z.object({
  runMonth: geoAeoMonthSchema,
  baselineMonth: geoAeoMonthSchema.optional(),
  comparisonMonth: geoAeoMonthSchema.optional(),
  baselineScore: z.number().min(0).max(100).optional(),
  currentScore: z.number().min(0).max(100).optional(),
  baselineSnapshotCount: z.number().int().min(0).default(0),
  currentSnapshotCount: z.number().int().min(0).default(0),
  actionPlanTemplate: z.record(z.string(), z.unknown()).default({}),
  reportTemplate: z.record(z.string(), z.unknown()).default({}),
  summary: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const geoAeoMonitoringRunUpdateSchema = geoAeoMonitoringRunCreateSchema.partial().extend({
  status: z.enum(["draft", "in_review", "approved", "archived"]).optional(),
});

export const geoAeoScoreOverrideSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string().trim().min(10).max(1000),
});

export const geoAeoScoreInputsSchema = z.object({
  brandMentionCoverage: z.number().min(0).max(100).optional(),
  citationCoverage: z.number().min(0).max(100).optional(),
  promptIntentCoverage: z.number().min(0).max(100).optional(),
  competitorGapOpportunity: z.number().min(0).max(100).optional(),
  entityClarityScore: z.number().min(0).max(100).optional(),
  schemaReadinessScore: z.number().min(0).max(100).optional(),
  sourceAuthorityReadiness: z.number().min(0).max(100).optional(),
  accuracyRiskScore: z.number().min(0).max(100).optional(),
}) satisfies z.ZodType<GeoAeoScoreInputs>;

export type GeoAeoAuditCreateInput = z.infer<typeof geoAeoAuditCreateSchema>;
export type GeoAeoAuditUpdateInput = z.infer<typeof geoAeoAuditUpdateSchema>;
export type GeoAeoPromptCreateInput = z.infer<typeof geoAeoPromptCreateSchema>;
export type GeoAeoPromptImportCsvInput = z.infer<typeof geoAeoPromptImportCsvSchema>;
export type GeoAeoSnapshotCreateInput = z.infer<typeof geoAeoSnapshotCreateSchema>;
export type GeoAeoSnapshotImportCsvInput = z.infer<typeof geoAeoSnapshotImportCsvSchema>;
export type GeoAeoSnapshotUpdateInput = z.infer<typeof geoAeoSnapshotUpdateSchema>;
export type GeoAeoCompetitorCreateInput = z.infer<typeof geoAeoCompetitorCreateSchema>;
export type GeoAeoCompetitorUpdateInput = z.infer<typeof geoAeoCompetitorUpdateSchema>;
export type GeoAeoCitationCreateInput = z.infer<typeof geoAeoCitationCreateSchema>;
export type GeoAeoSourceRecommendationCreateInput = z.infer<
  typeof geoAeoSourceRecommendationCreateSchema
>;
export type GeoAeoSourceRecommendationUpdateInput = z.infer<
  typeof geoAeoSourceRecommendationUpdateSchema
>;
export type GeoAeoSchemaFindingCreateInput = z.infer<typeof geoAeoSchemaFindingCreateSchema>;
export type GeoAeoSchemaFindingUpdateInput = z.infer<typeof geoAeoSchemaFindingUpdateSchema>;
export type GeoAeoMonitoringRunCreateInput = z.infer<typeof geoAeoMonitoringRunCreateSchema>;
export type GeoAeoMonitoringRunUpdateInput = z.infer<typeof geoAeoMonitoringRunUpdateSchema>;
