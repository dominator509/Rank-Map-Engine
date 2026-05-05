import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { projectsTable } from "./projects";
import { keywordClustersTable } from "./keywords";
import { usersTable } from "./users";

export const contentBriefsTable = pgTable("content_briefs", {
  id: serial("id").primaryKey(),
  clusterId: integer("cluster_id").references(() => keywordClustersTable.id, {
    onDelete: "set null",
  }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  outline: jsonb("outline"),
  targetWordCount: integer("target_word_count"),
  status: text("status").notNull().default("draft"),
  assignedTo: integer("assigned_to").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertContentBriefSchema = createInsertSchema(contentBriefsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentBrief = z.infer<typeof insertContentBriefSchema>;
export type ContentBrief = typeof contentBriefsTable.$inferSelect;
