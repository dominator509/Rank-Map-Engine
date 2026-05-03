import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const contentCalendarEntriesTable = pgTable("content_calendar_entries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  briefId: integer("brief_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("planned"),
  dueDate: date("due_date"),
  publishedDate: date("published_date"),
  assignedTo: integer("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ContentCalendarEntry = typeof contentCalendarEntriesTable.$inferSelect;
export type InsertContentCalendarEntry = typeof contentCalendarEntriesTable.$inferInsert;
