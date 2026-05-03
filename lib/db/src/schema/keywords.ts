import { pgTable, serial, text, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { projectsTable } from "./projects";

export const keywordClustersTable = pgTable("keyword_clusters", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  pillarTopic: text("pillar_topic"),
  clusterType: text("cluster_type").notNull().default("cluster"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const keywordsTable = pgTable("keywords", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  clusterId: integer("cluster_id").references(() => keywordClustersTable.id, {
    onDelete: "set null",
  }),
  phrase: text("phrase").notNull(),
  searchVolume: integer("search_volume"),
  cpc: real("cpc"),
  kd: integer("kd"),
  intent: text("intent"),
  source: text("source").notNull().default("manual"),
  isActive: boolean("is_active").notNull().default(true),
  rawScore: real("raw_score"),
  finalScore: real("final_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKeywordSchema = createInsertSchema(keywordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertKeywordClusterSchema = createInsertSchema(keywordClustersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywordsTable.$inferSelect;
export type InsertKeywordCluster = z.infer<typeof insertKeywordClusterSchema>;
export type KeywordCluster = typeof keywordClustersTable.$inferSelect;
