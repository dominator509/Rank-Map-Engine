import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  reportsTable,
  projectsTable,
  keywordsTable,
  keywordClustersTable,
  contentBriefsTable,
} from "@workspace/db";
import { GenerateReportBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

async function assertProjectAccess(projectId: number, tenantId: number) {
  const [p] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
    .limit(1);
  return !!p;
}

router.get("/projects/:projectId/reports", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parsePositiveRouteInt(req.params.projectId);

  if (projectId == null) {
    res.status(400).json({ error: "Invalid projectId" });
    return;
  }

  if (!(await assertProjectAccess(projectId, tenantId))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const reports = await db
    .select()
    .from(reportsTable)
    .where(and(eq(reportsTable.projectId, projectId), eq(reportsTable.tenantId, tenantId)));

  res.json(reports);
});

router.post(
  "/projects/:projectId/reports",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = GenerateReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);

    if (projectId == null) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }

    if (!(await assertProjectAccess(projectId, tenantId))) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [keywords, clusters, briefs] = await Promise.all([
      db
        .select()
        .from(keywordsTable)
        .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId))),
      db
        .select()
        .from(keywordClustersTable)
        .where(
          and(
            eq(keywordClustersTable.projectId, projectId),
            eq(keywordClustersTable.tenantId, tenantId),
          ),
        ),
      db
        .select()
        .from(contentBriefsTable)
        .where(
          and(
            eq(contentBriefsTable.projectId, projectId),
            eq(contentBriefsTable.tenantId, tenantId),
          ),
        ),
    ]);

    const data: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalKeywords: keywords.length,
        totalClusters: clusters.length,
        totalBriefs: briefs.length,
        avgFinalScore:
          keywords.length > 0
            ? Math.round(
                (keywords.reduce((sum, k) => sum + (k.finalScore ?? 0), 0) / keywords.length) * 100,
              ) / 100
            : 0,
      },
    };

    if (parsed.data.type === "topical_authority") {
      data.pillars = clusters
        .filter((c) => c.clusterType === "pillar")
        .map((c) => ({
          label: c.label,
          keywordCount: keywords.filter((k) => k.clusterId === c.id).length,
        }));
    }

    if (parsed.data.type === "content_pipeline") {
      data.briefs = briefs.map((b) => ({
        title: b.title,
        status: b.status,
        targetWordCount: b.targetWordCount,
      }));
    }

    const [report] = await db
      .insert(reportsTable)
      .values({
        projectId,
        tenantId,
        type: parsed.data.type,
        format: parsed.data.format,
        generatedAt: new Date(),
        data,
      })
      .returning();

    res.status(201).json(report);
  },
);

router.get("/projects/:projectId/reports/:id", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parsePositiveRouteInt(req.params.projectId);
  const id = parsePositiveRouteInt(req.params.id);

  if (projectId == null || id == null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.id, id),
        eq(reportsTable.projectId, projectId),
        eq(reportsTable.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json(report);
});

router.delete(
  "/projects/:projectId/reports/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);
    const id = parsePositiveRouteInt(req.params.id);

    if (projectId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(reportsTable)
      .where(
        and(
          eq(reportsTable.id, id),
          eq(reportsTable.projectId, projectId),
          eq(reportsTable.tenantId, tenantId),
        ),
      );

    res.status(204).send();
  },
);

export default router;
