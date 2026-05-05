import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const customFieldsTable = pgTable("custom_fields", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  fieldType: text("field_type").notNull(),
  options: jsonb("options"),
  isRequired: boolean("is_required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customFieldValuesTable = pgTable("custom_field_values", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  fieldId: integer("field_id")
    .notNull()
    .references(() => customFieldsTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  value: jsonb("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CustomField = typeof customFieldsTable.$inferSelect;
export type InsertCustomField = typeof customFieldsTable.$inferInsert;
export type CustomFieldValue = typeof customFieldValuesTable.$inferSelect;
export type InsertCustomFieldValue = typeof customFieldValuesTable.$inferInsert;
