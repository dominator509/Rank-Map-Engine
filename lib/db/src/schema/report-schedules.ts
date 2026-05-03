import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { projectsTable } from "./projects";

export const reportSchedulesTable = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  frequency: text("frequency").notNull(),
  recipientEmails: jsonb("recipient_emails").notNull().default([]),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ReportSchedule = typeof reportSchedulesTable.$inferSelect;
export type InsertReportSchedule = typeof reportSchedulesTable.$inferInsert;
