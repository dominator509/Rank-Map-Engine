import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const integrationCredentialsTable = pgTable("integration_credentials", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  credentials: jsonb("credentials").notNull().default({}),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIntegrationCredentialSchema = createInsertSchema(integrationCredentialsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIntegrationCredential = z.infer<typeof insertIntegrationCredentialSchema>;
export type IntegrationCredential = typeof integrationCredentialsTable.$inferSelect;
