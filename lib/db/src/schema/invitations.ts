import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const userInvitationsTable = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("agency_user"),
  token: text("token").notNull().unique(),
  invitedBy: integer("invited_by")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInvitationSchema = createInsertSchema(userInvitationsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type UserInvitation = typeof userInvitationsTable.$inferSelect;
