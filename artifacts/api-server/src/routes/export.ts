import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  projectsTable,
  keywordsTable,
  keywordClustersTable,
  contentBriefsTable,
  reportsTable,
  projectScoreSettingsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

async function assertProjectAccess(projectId: number, tenantId: number) {
  const [p] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
    .limit(1);
  return !!p;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const v = row[h];
        if (v === null || v === undefined) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","),
    ),
  ];
  return lines.join("\n");
}

// Export project keywords as CSV
router.get("/projects/:projectId/export/keywords.csv", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }
  if (!(await assertProjectAccess(projectId, tenantId))) { res.status(404).json({ error: "Project not found" }); return; }

  const keywords = await db
    .select({
      phrase: keywordsTable.phrase,
      searchVolume: keywordsTable.searchVolume,
      cpc: keywordsTable.cpc,
      kd: keywordsTable.kd,
      intent: keywordsTable.intent,
      source: keywordsTable.source,
      finalScore: keywordsTable.finalScore,
    })
    .from(keywordsTable)
    .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="keywords-project-${projectId}.csv"`);
  res.send(toCSV(keywords as Record<string, unknown>[]));
});

// Export full project as JSON
router.get("/projects/:projectId/export/project.json", requireAuth, requireRole(["agency_admin", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
    .limit(1);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [keywords, clusters, briefs, reports, settings] = await Promise.all([
    db.select().from(keywordsTable).where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId))),
    db.select().from(keywordClustersTable).where(and(eq(keywordClustersTable.projectId, projectId), eq(keywordClustersTable.tenantId, tenantId))),
    db.select().from(contentBriefsTable).where(and(eq(contentBriefsTable.projectId, projectId), eq(contentBriefsTable.tenantId, tenantId))),
    db.select().from(reportsTable).where(and(eq(reportsTable.projectId, projectId), eq(reportsTable.tenantId, tenantId))),
    db.select().from(projectScoreSettingsTable).where(eq(projectScoreSettingsTable.projectId, projectId)).limit(1),
  ]);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="project-${projectId}-export.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: "1.0",
    project,
    keywords,
    clusters,
    briefs,
    reports,
    scoreSettings: settings[0] ?? null,
  });
});

export default router;
