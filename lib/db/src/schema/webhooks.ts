import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const webhookEndpointsTable = pgTable("webhook_endpoints", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: jsonb("events").$type<string[]>().notNull().default([]),
  secret: text("secret").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const webhookDeliveriesTable = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id")
    .notNull()
    .references(() => webhookEndpointsTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpointsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebhookEndpoint = z.infer<typeof insertWebhookEndpointSchema>;
export type WebhookEndpoint = typeof webhookEndpointsTable.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
