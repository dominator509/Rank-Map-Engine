import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const aiTasksTable = pgTable("ai_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id, {
    onDelete: "set null",
  }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  taskType: text("task_type").notNull(),
  provider: text("provider").notNull().default("mock"),
  status: text("status").notNull().default("queued"),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output"),
  error: text("error"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  approvedBy: integer("approved_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAiTaskSchema = createInsertSchema(aiTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiTask = z.infer<typeof insertAiTaskSchema>;
export type AiTask = typeof aiTasksTable.$inferSelect;
