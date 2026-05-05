import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db, keywordRankingsTable, keywordsTable, projectsTable } from "@workspace/db";
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

const CheckBody = z.object({
  keywordId: z.number().int().positive(),
  position: z.number().int().min(1).max(200).nullable(),
  url: z.string().url().nullable().optional(),
});

router.get("/projects/:projectId/rankings", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid projectId" });
    return;
  }
  if (!(await assertProjectAccess(projectId, tenantId))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Latest ranking per keyword
  const keywords = await db
    .select({
      id: keywordsTable.id,
      phrase: keywordsTable.phrase,
      searchVolume: keywordsTable.searchVolume,
    })
    .from(keywordsTable)
    .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

  const result = await Promise.all(
    keywords.map(async (kw) => {
      const [latest] = await db
        .select()
        .from(keywordRankingsTable)
        .where(
          and(
            eq(keywordRankingsTable.keywordId, kw.id),
            eq(keywordRankingsTable.tenantId, tenantId),
          ),
        )
        .orderBy(desc(keywordRankingsTable.checkedAt))
        .limit(1);
      return {
        ...kw,
        latestPosition: latest?.position ?? null,
        latestUrl: latest?.url ?? null,
        checkedAt: latest?.checkedAt ?? null,
      };
    }),
  );

  res.json(result);
});

router.get(
  "/projects/:projectId/rankings/:keywordId/history",
  requireAuth,
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parseInt(req.params.projectId as string, 10);
    const keywordId = parseInt(req.params.keywordId as string, 10);
    if (isNaN(projectId) || isNaN(keywordId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (!(await assertProjectAccess(projectId, tenantId))) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const history = await db
      .select()
      .from(keywordRankingsTable)
      .where(
        and(
          eq(keywordRankingsTable.keywordId, keywordId),
          eq(keywordRankingsTable.tenantId, tenantId),
        ),
      )
      .orderBy(desc(keywordRankingsTable.checkedAt))
      .limit(90);

    res.json(history);
  },
);

router.post(
  "/projects/:projectId/rankings/check",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }
    if (!(await assertProjectAccess(projectId, tenantId))) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const parsed = CheckBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const [ranking] = await db
      .insert(keywordRankingsTable)
      .values({ ...parsed.data, tenantId })
      .returning();
    res.status(201).json(ranking);
  },
);

// Mock bulk check — generates random positions for all project keywords
router.post(
  "/projects/:projectId/rankings/check-all",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parseInt(req.params.projectId as string, 10);
    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }
    if (!(await assertProjectAccess(projectId, tenantId))) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const keywords = await db
      .select({ id: keywordsTable.id })
      .from(keywordsTable)
      .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

    if (keywords.length === 0) {
      res.json({ checked: 0 });
      return;
    }

    const values = keywords.map((kw) => ({
      tenantId,
      keywordId: kw.id,
      position: Math.random() > 0.3 ? Math.floor(Math.random() * 100) + 1 : null,
      url: null,
    }));

    await db.insert(keywordRankingsTable).values(values);
    res.json({ checked: keywords.length });
  },
);

export default router;
