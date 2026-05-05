import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, keywordsTable, projectsTable, projectScoreSettingsTable } from "@workspace/db";
import { CreateKeywordBody, ImportKeywordsBody, UpdateKeywordBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { computeScore, defaultSettings } from "../lib/scoring.js";

const router = Router();

async function assertProjectAccess(projectId: number, tenantId: number): Promise<boolean> {
  const [p] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
    .limit(1);
  return !!p;
}

async function getScoreSettings(projectId: number) {
  const [s] = await db
    .select()
    .from(projectScoreSettingsTable)
    .where(eq(projectScoreSettingsTable.projectId, projectId))
    .limit(1);
  return s ?? defaultSettings();
}

router.get("/projects/:projectId/keywords", requireAuth, async (req, res): Promise<void> => {
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
    .select()
    .from(keywordsTable)
    .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

  res.json(keywords);
});

router.post(
  "/projects/:projectId/keywords",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = CreateKeywordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

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

    const settings = await getScoreSettings(projectId);
    const { rawScore, finalScore } = computeScore(parsed.data, settings);

    const [keyword] = await db
      .insert(keywordsTable)
      .values({
        ...parsed.data,
        projectId,
        tenantId,
        rawScore,
        finalScore,
        source: "manual",
      })
      .returning();

    res.status(201).json(keyword);
  },
);

router.post(
  "/projects/:projectId/keywords/import",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = ImportKeywordsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

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

    const settings = await getScoreSettings(projectId);
    const rows = parsed.data.keywords ?? [];

    const existingPhrases = new Set(
      (
        await db
          .select({ phrase: keywordsTable.phrase })
          .from(keywordsTable)
          .where(eq(keywordsTable.projectId, projectId))
      ).map((r) => r.phrase.toLowerCase()),
    );

    const toInsert = rows
      .filter((r: { phrase: string }) => r.phrase && !existingPhrases.has(r.phrase.toLowerCase()))
      .map(
        (r: {
          phrase: string;
          searchVolume?: number;
          cpc?: number;
          kd?: number;
          intent?: string;
        }) => {
          const { rawScore, finalScore } = computeScore(r, settings);
          return {
            projectId,
            tenantId,
            phrase: r.phrase,
            searchVolume: r.searchVolume ?? null,
            cpc: r.cpc ?? null,
            kd: r.kd ?? null,
            intent: r.intent ?? null,
            source: parsed.data.source,
            rawScore,
            finalScore,
          };
        },
      );

    const imported =
      toInsert.length > 0 ? await db.insert(keywordsTable).values(toInsert).returning() : [];

    const duplicates = rows.length - toInsert.length;
    res.json({
      imported: imported.length,
      duplicates,
      total: rows.length,
    });
  },
);

router.get("/projects/:projectId/keywords/:id", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(projectId) || isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [keyword] = await db
    .select()
    .from(keywordsTable)
    .where(
      and(
        eq(keywordsTable.id, id),
        eq(keywordsTable.projectId, projectId),
        eq(keywordsTable.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }

  res.json(keyword);
});

router.patch(
  "/projects/:projectId/keywords/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = UpdateKeywordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const projectId = parseInt(req.params.projectId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(projectId) || isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [existing] = await db
      .select()
      .from(keywordsTable)
      .where(
        and(
          eq(keywordsTable.id, id),
          eq(keywordsTable.projectId, projectId),
          eq(keywordsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Keyword not found" });
      return;
    }

    const d = parsed.data;
    const merged = {
      searchVolume: d.searchVolume ?? existing.searchVolume,
      cpc: d.cpc ?? existing.cpc,
      kd: d.kd ?? existing.kd,
      intent: d.intent ?? existing.intent,
      clusterId: d.clusterId !== undefined ? d.clusterId : existing.clusterId,
      isActive: d.isActive !== undefined ? d.isActive : existing.isActive,
    };

    const settings = await getScoreSettings(projectId);
    const { rawScore, finalScore } = computeScore(merged, settings);

    const [updated] = await db
      .update(keywordsTable)
      .set({ ...merged, rawScore, finalScore })
      .where(eq(keywordsTable.id, id))
      .returning();

    res.json(updated);
  },
);

router.delete(
  "/projects/:projectId/keywords/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parseInt(req.params.projectId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(projectId) || isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(keywordsTable)
      .where(
        and(
          eq(keywordsTable.id, id),
          eq(keywordsTable.projectId, projectId),
          eq(keywordsTable.tenantId, tenantId),
        ),
      );

    res.status(204).send();
  },
);

export default router;
