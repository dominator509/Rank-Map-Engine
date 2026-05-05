import { Router } from "express";
import { eq, and, gte, count, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  keywordsTable,
  keywordClustersTable,
  contentBriefsTable,
  reportsTable,
  aiTasksTable,
  clientsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/analytics/overview", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    [clientCount],
    [projectCount],
    [keywordCount],
    [clusterCount],
    [briefCount],
    [reportCount],
    [aiTaskCount],
    keywordsBySource,
    briefsByStatus,
    clustersByStatus,
  ] = await Promise.all([
    db.select({ c: count() }).from(clientsTable).where(eq(clientsTable.tenantId, tenantId)),
    db.select({ c: count() }).from(projectsTable).where(eq(projectsTable.tenantId, tenantId)),
    db.select({ c: count() }).from(keywordsTable).where(eq(keywordsTable.tenantId, tenantId)),
    db
      .select({ c: count() })
      .from(keywordClustersTable)
      .where(eq(keywordClustersTable.tenantId, tenantId)),
    db
      .select({ c: count() })
      .from(contentBriefsTable)
      .where(eq(contentBriefsTable.tenantId, tenantId)),
    db.select({ c: count() }).from(reportsTable).where(eq(reportsTable.tenantId, tenantId)),
    db
      .select({ c: count() })
      .from(aiTasksTable)
      .where(and(eq(aiTasksTable.tenantId, tenantId), gte(aiTasksTable.createdAt, thirtyDaysAgo))),
    db
      .select({ source: keywordsTable.source, c: count() })
      .from(keywordsTable)
      .where(eq(keywordsTable.tenantId, tenantId))
      .groupBy(keywordsTable.source),
    db
      .select({ status: contentBriefsTable.status, c: count() })
      .from(contentBriefsTable)
      .where(eq(contentBriefsTable.tenantId, tenantId))
      .groupBy(contentBriefsTable.status),
    db
      .select({ status: keywordClustersTable.status, c: count() })
      .from(keywordClustersTable)
      .where(eq(keywordClustersTable.tenantId, tenantId))
      .groupBy(keywordClustersTable.status),
  ]);

  res.json({
    totals: {
      clients: clientCount.c,
      projects: projectCount.c,
      keywords: keywordCount.c,
      clusters: clusterCount.c,
      briefs: briefCount.c,
      reports: reportCount.c,
      aiTasksThisMonth: aiTaskCount.c,
    },
    keywordsBySource,
    briefsByStatus,
    clustersByStatus,
  });
});

router.get("/analytics/projects", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  const projects = await db
    .select({ id: projectsTable.id, name: projectsTable.name, createdAt: projectsTable.createdAt })
    .from(projectsTable)
    .where(eq(projectsTable.tenantId, tenantId));

  const result = await Promise.all(
    projects.map(async (p) => {
      const [[kc], [cc], [bc]] = await Promise.all([
        db
          .select({ c: count() })
          .from(keywordsTable)
          .where(and(eq(keywordsTable.projectId, p.id), eq(keywordsTable.tenantId, tenantId))),
        db
          .select({ c: count() })
          .from(keywordClustersTable)
          .where(
            and(
              eq(keywordClustersTable.projectId, p.id),
              eq(keywordClustersTable.tenantId, tenantId),
            ),
          ),
        db
          .select({ c: count() })
          .from(contentBriefsTable)
          .where(
            and(eq(contentBriefsTable.projectId, p.id), eq(contentBriefsTable.tenantId, tenantId)),
          ),
      ]);
      return { ...p, keywordCount: kc.c, clusterCount: cc.c, briefCount: bc.c };
    }),
  );

  res.json(result);
});

router.get("/analytics/velocity", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  // Keywords added per day over last 30 days (mock)
  const rows = await db
    .select({
      day: sql<string>`DATE(${keywordsTable.createdAt})`.as("day"),
      count: count(),
    })
    .from(keywordsTable)
    .where(
      and(
        eq(keywordsTable.tenantId, tenantId),
        gte(keywordsTable.createdAt, new Date(Date.now() - 30 * 86400000)),
      ),
    )
    .groupBy(sql`DATE(${keywordsTable.createdAt})`)
    .orderBy(sql`DATE(${keywordsTable.createdAt})`);

  res.json(rows);
});

export default router;
