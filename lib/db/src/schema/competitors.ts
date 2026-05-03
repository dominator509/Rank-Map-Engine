import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { projectsTable } from "./projects";

export const competitorDomainsTable = pgTable("competitor_domains", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CompetitorDomain = typeof competitorDomainsTable.$inferSelect;
export type InsertCompetitorDomain = typeof competitorDomainsTable.$inferInsert;
