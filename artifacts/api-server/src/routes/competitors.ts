import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, competitorDomainsTable, projectsTable, keywordsTable } from "@workspace/db";
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

const DomainBody = z.object({
  domain: z.string().min(1).max(255),
  label: z.string().max(100).optional(),
});

router.get("/projects/:projectId/competitors", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }
  if (!(await assertProjectAccess(projectId, tenantId))) { res.status(404).json({ error: "Project not found" }); return; }

  const competitors = await db
    .select()
    .from(competitorDomainsTable)
    .where(and(eq(competitorDomainsTable.projectId, projectId), eq(competitorDomainsTable.tenantId, tenantId)))
    .orderBy(competitorDomainsTable.createdAt);

  res.json(competitors);
});

router.post("/projects/:projectId/competitors", requireAuth, requireRole(["agency_admin", "agency_user", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }
  if (!(await assertProjectAccess(projectId, tenantId))) { res.status(404).json({ error: "Project not found" }); return; }

  const parsed = DomainBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }

  const [competitor] = await db
    .insert(competitorDomainsTable)
    .values({ ...parsed.data, projectId, tenantId })
    .returning();
  res.status(201).json(competitor);
});

router.delete("/projects/:projectId/competitors/:id", requireAuth, requireRole(["agency_admin", "agency_user", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(projectId) || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .delete(competitorDomainsTable)
    .where(and(eq(competitorDomainsTable.id, id), eq(competitorDomainsTable.projectId, projectId), eq(competitorDomainsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

// Keyword gap analysis — returns project keywords not found in competitor mock data
router.get("/projects/:projectId/competitors/keyword-gap", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }
  if (!(await assertProjectAccess(projectId, tenantId))) { res.status(404).json({ error: "Project not found" }); return; }

  const competitors = await db
    .select()
    .from(competitorDomainsTable)
    .where(and(eq(competitorDomainsTable.projectId, projectId), eq(competitorDomainsTable.tenantId, tenantId)));

  const keywords = await db
    .select({ id: keywordsTable.id, phrase: keywordsTable.phrase, searchVolume: keywordsTable.searchVolume, kd: keywordsTable.kd, finalScore: keywordsTable.finalScore })
    .from(keywordsTable)
    .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

  // Mock gap analysis: pretend each competitor covers random 40% of keywords
  const gap = keywords.map((kw) => {
    const competitorCoverage = competitors.map((c) => ({
      domain: c.domain,
      ranking: Math.random() > 0.6 ? Math.floor(Math.random() * 50) + 1 : null,
    }));
    return { ...kw, competitorCoverage };
  });

  res.json({ keywords: gap, competitors });
});

export default router;
