import { z } from "zod";
import {
  GEO_AEO_ACTION_CATEGORIES,
  GEO_AEO_CAPTURE_METHODS,
  GEO_AEO_ENGINES,
  GEO_AEO_FINDING_TYPES,
} from "./constants.js";

export const geoAeoEngineSchema = z.enum(GEO_AEO_ENGINES);
export const geoAeoCaptureMethodSchema = z.enum(GEO_AEO_CAPTURE_METHODS);
export const geoAeoFindingTypeSchema = z.enum(GEO_AEO_FINDING_TYPES);
export const geoAeoActionCategorySchema = z.enum(GEO_AEO_ACTION_CATEGORIES);

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
});

export const geoAeoPromptCreateSchema = z.object({
  auditId: z.number().int().positive(),
  promptText: z.string().trim().min(1).max(2000),
  intent: z.string().trim().max(120).optional(),
  funnelStage: z.string().trim().max(120).optional(),
  serviceOrProduct: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  priority: z.number().int().min(0).max(100).default(50),
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

export const geoAeoScoreOverrideSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string().trim().min(10).max(1000),
});

export type GeoAeoAuditCreateInput = z.infer<typeof geoAeoAuditCreateSchema>;
export type GeoAeoPromptCreateInput = z.infer<typeof geoAeoPromptCreateSchema>;
export type GeoAeoSnapshotCreateInput = z.infer<typeof geoAeoSnapshotCreateSchema>;
