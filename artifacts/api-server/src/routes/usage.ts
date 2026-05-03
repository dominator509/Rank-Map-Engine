import { Router } from "express";
import { eq, and, gte, count } from "drizzle-orm";
import {
  db,
  keywordsTable,
  contentBriefsTable,
  aiTasksTable,
  reportsTable,
  usersTable,
  tenantsTable,
  apiKeysTable,
  webhookDeliveriesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/usage", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    [tenant],
    [kwTotal],
    [briefTotal],
    [aiThisMonth],
    [reportsThisMonth],
    [seats],
    [apiKeyCount],
    [webhooksThisMonth],
  ] = await Promise.all([
    db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1),
    db.select({ c: count() }).from(keywordsTable).where(eq(keywordsTable.tenantId, tenantId)),
    db.select({ c: count() }).from(contentBriefsTable).where(eq(contentBriefsTable.tenantId, tenantId)),
    db.select({ c: count() }).from(aiTasksTable).where(and(eq(aiTasksTable.tenantId, tenantId), gte(aiTasksTable.createdAt, monthStart))),
    db.select({ c: count() }).from(reportsTable).where(and(eq(reportsTable.tenantId, tenantId), gte(reportsTable.createdAt, monthStart))),
    db.select({ c: count() }).from(usersTable).where(eq(usersTable.tenantId, tenantId)),
    db.select({ c: count() }).from(apiKeysTable).where(and(eq(apiKeysTable.tenantId, tenantId))),
    db.select({ c: count() }).from(webhookDeliveriesTable).where(and(eq(webhookDeliveriesTable.tenantId, tenantId), gte(webhookDeliveriesTable.createdAt, monthStart))),
  ]);

  const planLimits: Record<string, { keywords: number; briefs: number; aiTasks: number; seats: number }> = {
    solo: { keywords: 500, briefs: 20, aiTasks: 50, seats: 1 },
    starter: { keywords: 5000, briefs: 200, aiTasks: 500, seats: 5 },
    agency: { keywords: 50000, briefs: 2000, aiTasks: 5000, seats: 25 },
    enterprise: { keywords: -1, briefs: -1, aiTasks: -1, seats: -1 },
  };

  const plan = tenant?.plan ?? "solo";
  const limits = planLimits[plan] ?? planLimits.solo;

  res.json({
    plan,
    period: { start: monthStart.toISOString(), end: now.toISOString() },
    usage: {
      keywords: { used: kwTotal.c, limit: limits.keywords },
      briefs: { used: briefTotal.c, limit: limits.briefs },
      aiTasks: { used: aiThisMonth.c, limit: limits.aiTasks },
      seats: { used: seats.c, limit: limits.seats },
      reportsThisMonth: reportsThisMonth.c,
      apiKeys: apiKeyCount.c,
      webhookDeliveriesThisMonth: webhooksThisMonth.c,
    },
  });
});

export default router;
