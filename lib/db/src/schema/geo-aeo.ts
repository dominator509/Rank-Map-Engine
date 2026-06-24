import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());
const deletedAt = timestamp("deleted_at", { withTimezone: true });

export const geoAeoAuditsTable = pgTable(
  "geo_aeo_audits",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id, { onDelete: "cascade" }),
    projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
    auditName: text("audit_name").notNull(),
    websiteUrl: text("website_url").notNull(),
    niche: text("niche").notNull(),
    servicesOrProducts: jsonb("services_or_products"),
    targetLocation: text("target_location"),
    targetAudience: text("target_audience"),
    status: text("status").notNull().default("draft"),
    monitoringEnabled: boolean("monitoring_enabled").notNull().default(false),
    monitoringCadence: text("monitoring_cadence").notNull().default("none"),
    nextMonitoringRunAt: timestamp("next_monitoring_run_at", { withTimezone: true }),
    businessFacts: jsonb("business_facts"),
    visibilityScore: real("visibility_score"),
    visibilityLabel: text("visibility_label"),
    summary: text("summary"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedById: integer("approved_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_audits_tenant_idx").on(table.tenantId),
    index("geo_aeo_audits_client_idx").on(table.clientId),
    index("geo_aeo_audits_project_idx").on(table.projectId),
    index("geo_aeo_audits_status_idx").on(table.status),
    index("geo_aeo_audits_monitoring_idx").on(table.monitoringEnabled, table.nextMonitoringRunAt),
  ],
);

export const geoAeoEnginesTable = pgTable(
  "geo_aeo_engines",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    engine: text("engine").notNull(),
    displayName: text("display_name").notNull(),
    mode: text("mode").notNull().default("manual"),
    status: text("status").notNull().default("active"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("geo_aeo_engines_tenant_idx").on(table.tenantId),
    index("geo_aeo_engines_audit_idx").on(table.auditId),
    index("geo_aeo_engines_engine_idx").on(table.engine),
  ],
);

export const geoAeoPromptSetsTable = pgTable(
  "geo_aeo_prompt_sets",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_prompt_sets_tenant_idx").on(table.tenantId),
    index("geo_aeo_prompt_sets_audit_idx").on(table.auditId),
    index("geo_aeo_prompt_sets_status_idx").on(table.status),
  ],
);

export const geoAeoPromptsTable = pgTable(
  "geo_aeo_prompts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    promptSetId: integer("prompt_set_id").references(() => geoAeoPromptSetsTable.id, {
      onDelete: "set null",
    }),
    promptText: text("prompt_text").notNull(),
    normalizedPrompt: text("normalized_prompt"),
    intent: text("intent"),
    funnelStage: text("funnel_stage"),
    serviceOrProduct: text("service_or_product"),
    location: text("location"),
    priority: integer("priority").notNull().default(50),
    status: text("status").notNull().default("draft"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_prompts_tenant_idx").on(table.tenantId),
    index("geo_aeo_prompts_audit_idx").on(table.auditId),
    index("geo_aeo_prompts_prompt_set_idx").on(table.promptSetId),
    index("geo_aeo_prompts_status_idx").on(table.status),
  ],
);

export const geoAeoPromptVariantsTable = pgTable(
  "geo_aeo_prompt_variants",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => geoAeoPromptsTable.id, { onDelete: "cascade" }),
    variantText: text("variant_text").notNull(),
    variantType: text("variant_type").notNull().default("manual"),
    status: text("status").notNull().default("active"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_prompt_variants_tenant_idx").on(table.tenantId),
    index("geo_aeo_prompt_variants_audit_idx").on(table.auditId),
    index("geo_aeo_prompt_variants_prompt_idx").on(table.promptId),
    index("geo_aeo_prompt_variants_status_idx").on(table.status),
  ],
);

export const geoAeoAnswerSnapshotsTable = pgTable(
  "geo_aeo_answer_snapshots",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => geoAeoPromptsTable.id, { onDelete: "cascade" }),
    promptVariantId: integer("prompt_variant_id").references(() => geoAeoPromptVariantsTable.id, {
      onDelete: "set null",
    }),
    engine: text("engine").notNull(),
    engineMode: text("engine_mode").notNull().default("consumer_manual"),
    captureMethod: text("capture_method").notNull(),
    answerText: text("answer_text").notNull(),
    answerHash: text("answer_hash").notNull(),
    locationContext: text("location_context"),
    clientMentioned: boolean("client_mentioned").notNull().default(false),
    clientCited: boolean("client_cited").notNull().default(false),
    sentiment: text("sentiment"),
    accuracyRiskScore: real("accuracy_risk_score"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedById: integer("approved_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_answer_snapshots_tenant_idx").on(table.tenantId),
    index("geo_aeo_answer_snapshots_audit_idx").on(table.auditId),
    index("geo_aeo_answer_snapshots_prompt_idx").on(table.promptId),
    index("geo_aeo_answer_snapshots_engine_idx").on(table.engine),
    index("geo_aeo_answer_snapshots_capture_idx").on(table.captureMethod),
  ],
);

export const geoAeoMentionsTable = pgTable(
  "geo_aeo_mentions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => geoAeoAnswerSnapshotsTable.id, { onDelete: "cascade" }),
    mentionedEntityType: text("mentioned_entity_type").notNull(),
    mentionedEntityName: text("mentioned_entity_name").notNull(),
    isClient: boolean("is_client").notNull().default(false),
    isCompetitor: boolean("is_competitor").notNull().default(false),
    position: integer("position"),
    sentiment: text("sentiment"),
    evidenceSnippet: text("evidence_snippet"),
    confidenceScore: real("confidence_score"),
    createdAt,
  },
  (table) => [
    index("geo_aeo_mentions_tenant_idx").on(table.tenantId),
    index("geo_aeo_mentions_audit_idx").on(table.auditId),
    index("geo_aeo_mentions_snapshot_idx").on(table.snapshotId),
  ],
);

export const geoAeoCitationsTable = pgTable(
  "geo_aeo_citations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    snapshotId: integer("snapshot_id").references(() => geoAeoAnswerSnapshotsTable.id, {
      onDelete: "cascade",
    }),
    url: text("url"),
    sourceName: text("source_name"),
    sourceType: text("source_type"),
    isClientOwned: boolean("is_client_owned").notNull().default(false),
    isCompetitorOwned: boolean("is_competitor_owned").notNull().default(false),
    authorityEstimate: real("authority_estimate"),
    notes: text("notes"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_citations_tenant_idx").on(table.tenantId),
    index("geo_aeo_citations_audit_idx").on(table.auditId),
    index("geo_aeo_citations_snapshot_idx").on(table.snapshotId),
  ],
);

export const geoAeoCompetitorsTable = pgTable(
  "geo_aeo_competitors",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    aliases: jsonb("aliases"),
    notes: text("notes"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_competitors_tenant_idx").on(table.tenantId),
    index("geo_aeo_competitors_audit_idx").on(table.auditId),
  ],
);

export const geoAeoVisibilityScoresTable = pgTable(
  "geo_aeo_visibility_scores",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    label: text("label").notNull(),
    inputs: jsonb("inputs"),
    explanations: jsonb("explanations"),
    isManualOverride: boolean("is_manual_override").notNull().default(false),
    overrideReason: text("override_reason"),
    overriddenById: integer("overridden_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
  },
  (table) => [
    index("geo_aeo_visibility_scores_tenant_idx").on(table.tenantId),
    index("geo_aeo_visibility_scores_audit_idx").on(table.auditId),
  ],
);

export const geoAeoFindingsTable = pgTable(
  "geo_aeo_findings",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    findingType: text("finding_type").notNull(),
    severity: text("severity").notNull().default("medium"),
    title: text("title").notNull(),
    description: text("description"),
    evidence: jsonb("evidence"),
    recommendation: text("recommendation"),
    status: text("status").notNull().default("draft"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedById: integer("approved_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_findings_tenant_idx").on(table.tenantId),
    index("geo_aeo_findings_audit_idx").on(table.auditId),
    index("geo_aeo_findings_type_idx").on(table.findingType),
    index("geo_aeo_findings_status_idx").on(table.status),
  ],
);

export const geoAeoSourceRecommendationsTable = pgTable(
  "geo_aeo_source_recommendations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    sourceType: text("source_type"),
    reason: text("reason"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("draft"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_source_recommendations_tenant_idx").on(table.tenantId),
    index("geo_aeo_source_recommendations_audit_idx").on(table.auditId),
    index("geo_aeo_source_recommendations_status_idx").on(table.status),
  ],
);

export const geoAeoSchemaFindingsTable = pgTable(
  "geo_aeo_schema_findings",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    pageUrl: text("page_url"),
    schemaType: text("schema_type"),
    issueType: text("issue_type").notNull(),
    severity: text("severity").notNull().default("medium"),
    recommendation: text("recommendation"),
    status: text("status").notNull().default("draft"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_schema_findings_tenant_idx").on(table.tenantId),
    index("geo_aeo_schema_findings_audit_idx").on(table.auditId),
    index("geo_aeo_schema_findings_status_idx").on(table.status),
  ],
);

export const geoAeoActionPlansTable = pgTable(
  "geo_aeo_action_plans",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    timeHorizonDays: integer("time_horizon_days").notNull().default(30),
    summary: text("summary"),
    status: text("status").notNull().default("draft"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedById: integer("approved_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_action_plans_tenant_idx").on(table.tenantId),
    index("geo_aeo_action_plans_audit_idx").on(table.auditId),
    index("geo_aeo_action_plans_status_idx").on(table.status),
  ],
);

export const geoAeoActionItemsTable = pgTable(
  "geo_aeo_action_items",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    actionPlanId: integer("action_plan_id")
      .notNull()
      .references(() => geoAeoActionPlansTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    priority: text("priority").notNull().default("medium"),
    weekNumber: integer("week_number").notNull().default(1),
    ownerRole: text("owner_role"),
    status: text("status").notNull().default("draft"),
    relatedFindingId: integer("related_finding_id").references(() => geoAeoFindingsTable.id, {
      onDelete: "set null",
    }),
    relatedPromptId: integer("related_prompt_id").references(() => geoAeoPromptsTable.id, {
      onDelete: "set null",
    }),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_action_items_tenant_idx").on(table.tenantId),
    index("geo_aeo_action_items_audit_idx").on(table.auditId),
    index("geo_aeo_action_items_plan_idx").on(table.actionPlanId),
    index("geo_aeo_action_items_status_idx").on(table.status),
  ],
);

export const geoAeoMonitoringRunsTable = pgTable(
  "geo_aeo_monitoring_runs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    auditId: integer("audit_id")
      .notNull()
      .references(() => geoAeoAuditsTable.id, { onDelete: "cascade" }),
    runMonth: text("run_month").notNull(),
    baselineMonth: text("baseline_month"),
    comparisonMonth: text("comparison_month").notNull(),
    status: text("status").notNull().default("draft"),
    baselineScore: real("baseline_score"),
    currentScore: real("current_score"),
    scoreDelta: real("score_delta"),
    baselineSnapshotCount: integer("baseline_snapshot_count").notNull().default(0),
    currentSnapshotCount: integer("current_snapshot_count").notNull().default(0),
    actionPlanTemplate: jsonb("action_plan_template"),
    reportTemplate: jsonb("report_template"),
    summary: text("summary"),
    notes: text("notes"),
    createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedById: integer("approved_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("geo_aeo_monitoring_runs_tenant_idx").on(table.tenantId),
    index("geo_aeo_monitoring_runs_audit_idx").on(table.auditId),
    index("geo_aeo_monitoring_runs_month_idx").on(table.runMonth),
    index("geo_aeo_monitoring_runs_status_idx").on(table.status),
  ],
);

export const insertGeoAeoAuditSchema = createInsertSchema(geoAeoAuditsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoEngineSchema = createInsertSchema(geoAeoEnginesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoPromptSetSchema = createInsertSchema(geoAeoPromptSetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoPromptSchema = createInsertSchema(geoAeoPromptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoPromptVariantSchema = createInsertSchema(
  geoAeoPromptVariantsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoAnswerSnapshotSchema = createInsertSchema(
  geoAeoAnswerSnapshotsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoFindingSchema = createInsertSchema(geoAeoFindingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoActionPlanSchema = createInsertSchema(geoAeoActionPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoActionItemSchema = createInsertSchema(geoAeoActionItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGeoAeoMonitoringRunSchema = createInsertSchema(geoAeoMonitoringRunsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GeoAeoAudit = typeof geoAeoAuditsTable.$inferSelect;
export type InsertGeoAeoAudit = z.infer<typeof insertGeoAeoAuditSchema>;
export type GeoAeoEngineRecord = typeof geoAeoEnginesTable.$inferSelect;
export type GeoAeoPromptSet = typeof geoAeoPromptSetsTable.$inferSelect;
export type GeoAeoPrompt = typeof geoAeoPromptsTable.$inferSelect;
export type GeoAeoPromptVariant = typeof geoAeoPromptVariantsTable.$inferSelect;
export type GeoAeoAnswerSnapshot = typeof geoAeoAnswerSnapshotsTable.$inferSelect;
export type GeoAeoMention = typeof geoAeoMentionsTable.$inferSelect;
export type GeoAeoCitation = typeof geoAeoCitationsTable.$inferSelect;
export type GeoAeoCompetitor = typeof geoAeoCompetitorsTable.$inferSelect;
export type GeoAeoVisibilityScore = typeof geoAeoVisibilityScoresTable.$inferSelect;
export type GeoAeoFinding = typeof geoAeoFindingsTable.$inferSelect;
export type GeoAeoSourceRecommendation = typeof geoAeoSourceRecommendationsTable.$inferSelect;
export type GeoAeoSchemaFinding = typeof geoAeoSchemaFindingsTable.$inferSelect;
export type GeoAeoActionPlan = typeof geoAeoActionPlansTable.$inferSelect;
export type GeoAeoActionItem = typeof geoAeoActionItemsTable.$inferSelect;
export type GeoAeoMonitoringRun = typeof geoAeoMonitoringRunsTable.$inferSelect;
