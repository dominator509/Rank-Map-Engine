import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { keywordsTable } from "./keywords";

export const keywordRankingsTable = pgTable("keyword_rankings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenantsTable.id, { onDelete: "cascade" }),
  keywordId: integer("keyword_id")
    .notNull()
    .references(() => keywordsTable.id, { onDelete: "cascade" }),
  position: integer("position"),
  url: text("url"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KeywordRanking = typeof keywordRankingsTable.$inferSelect;
export type InsertKeywordRanking = typeof keywordRankingsTable.$inferInsert;
