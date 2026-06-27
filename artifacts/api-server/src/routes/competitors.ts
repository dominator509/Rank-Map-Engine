import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, competitorDomainsTable, projectsTable, keywordsTable } from "@workspace/db";
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

const DomainBody = z.object({
  domain: z.string().min(1).max(255),
  label: z.string().max(100).optional(),
});

function stableRankSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function estimateCompetitorRanking(keywordId: number, competitorDomain: string): number | null {
  const seed = stableRankSeed(`${keywordId}:${competitorDomain.toLowerCase()}`);
  return seed % 5 < 2 ? Math.floor(seed % 50) + 1 : null;
}

router.get("/projects/:projectId/competitors", requireAuth, async (req, res): Promise<void> => {
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

  const competitors = await db
    .select()
    .from(competitorDomainsTable)
    .where(
      and(
        eq(competitorDomainsTable.projectId, projectId),
        eq(competitorDomainsTable.tenantId, tenantId),
      ),
    )
    .orderBy(competitorDomainsTable.createdAt);

  res.json(competitors);
});

router.post(
  "/projects/:projectId/competitors",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
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

    const parsed = DomainBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const [competitor] = await db
      .insert(competitorDomainsTable)
      .values({ ...parsed.data, projectId, tenantId })
      .returning();
    res.status(201).json(competitor);
  },
);

router.delete(
  "/projects/:projectId/competitors/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);
    const id = parsePositiveRouteInt(req.params.id);
    if (projectId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(competitorDomainsTable)
      .where(
        and(
          eq(competitorDomainsTable.id, id),
          eq(competitorDomainsTable.projectId, projectId),
          eq(competitorDomainsTable.tenantId, tenantId),
        ),
      );
    res.json({ ok: true });
  },
);

// Keyword gap analysis — returns project keywords not found in competitor mock data
router.get(
  "/projects/:projectId/competitors/keyword-gap",
  requireAuth,
  async (req, res): Promise<void> => {
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

    const competitors = await db
      .select()
      .from(competitorDomainsTable)
      .where(
        and(
          eq(competitorDomainsTable.projectId, projectId),
          eq(competitorDomainsTable.tenantId, tenantId),
        ),
      );

    const keywords = await db
      .select({
        id: keywordsTable.id,
        phrase: keywordsTable.phrase,
        searchVolume: keywordsTable.searchVolume,
        kd: keywordsTable.kd,
        finalScore: keywordsTable.finalScore,
      })
      .from(keywordsTable)
      .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

    // Placeholder gap analysis stays deterministic until live competitor ranking data is wired.
    const gap = keywords.map((kw) => {
      const competitorCoverage = competitors.map((c) => ({
        domain: c.domain,
        ranking: estimateCompetitorRanking(kw.id, c.domain),
      }));
      return { ...kw, competitorCoverage };
    });

    res.json({ keywords: gap, competitors });
  },
);

export default router;
