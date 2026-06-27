import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  contentBriefsTable,
  projectsTable,
  keywordsTable,
  keywordClustersTable,
  usersTable,
} from "@workspace/db";
import { CreateBriefBody, UpdateBriefBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { enqueueAiTask } from "../lib/ai.js";
import { generateBriefWithAI } from "../lib/ai-provider.js";

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

async function assertClusterAccess(clusterId: number, projectId: number, tenantId: number) {
  const [cluster] = await db
    .select({ id: keywordClustersTable.id })
    .from(keywordClustersTable)
    .where(
      and(
        eq(keywordClustersTable.id, clusterId),
        eq(keywordClustersTable.projectId, projectId),
        eq(keywordClustersTable.tenantId, tenantId),
      ),
    )
    .limit(1);
  return !!cluster;
}

async function assertUserAccess(userId: number, tenantId: number) {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
    .limit(1);
  return !!user;
}

router.get("/projects/:projectId/briefs", requireAuth, async (req, res): Promise<void> => {
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

  const briefs = await db
    .select()
    .from(contentBriefsTable)
    .where(
      and(eq(contentBriefsTable.projectId, projectId), eq(contentBriefsTable.tenantId, tenantId)),
    );

  res.json(briefs);
});

router.post(
  "/projects/:projectId/briefs",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = CreateBriefBody.safeParse(req.body);
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

    if (
      parsed.data.clusterId !== undefined &&
      !(await assertClusterAccess(parsed.data.clusterId, projectId, tenantId))
    ) {
      res.status(400).json({ error: "Invalid clusterId" });
      return;
    }

    const [brief] = await db
      .insert(contentBriefsTable)
      .values({ ...parsed.data, projectId, tenantId, status: "draft" })
      .returning();

    res.status(201).json(brief);
  },
);

router.get("/projects/:projectId/briefs/:id", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parsePositiveRouteInt(req.params.projectId);
  const id = parsePositiveRouteInt(req.params.id);

  if (projectId == null || id == null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [brief] = await db
    .select()
    .from(contentBriefsTable)
    .where(
      and(
        eq(contentBriefsTable.id, id),
        eq(contentBriefsTable.projectId, projectId),
        eq(contentBriefsTable.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!brief) {
    res.status(404).json({ error: "Brief not found" });
    return;
  }

  res.json(brief);
});

router.patch(
  "/projects/:projectId/briefs/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = UpdateBriefBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);
    const id = parsePositiveRouteInt(req.params.id);

    if (projectId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const updates: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.assignedTo != null && !(await assertUserAccess(d.assignedTo, tenantId))) {
      res.status(400).json({ error: "Invalid assignedTo" });
      return;
    }
    if (d.title !== undefined) updates.title = d.title;
    if (d.outline !== undefined) updates.outline = d.outline;
    if (d.targetWordCount !== undefined) updates.targetWordCount = d.targetWordCount;
    if (d.status !== undefined) updates.status = d.status;
    if (d.assignedTo !== undefined) updates.assignedTo = d.assignedTo;

    const [updated] = await db
      .update(contentBriefsTable)
      .set(updates)
      .where(
        and(
          eq(contentBriefsTable.id, id),
          eq(contentBriefsTable.projectId, projectId),
          eq(contentBriefsTable.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Brief not found" });
      return;
    }

    res.json(updated);
  },
);

router.delete(
  "/projects/:projectId/briefs/:id",
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
      .delete(contentBriefsTable)
      .where(
        and(
          eq(contentBriefsTable.id, id),
          eq(contentBriefsTable.projectId, projectId),
          eq(contentBriefsTable.tenantId, tenantId),
        ),
      );

    res.status(204).send();
  },
);

router.post(
  "/projects/:projectId/briefs/:id/generate",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);
    const id = parsePositiveRouteInt(req.params.id);

    if (projectId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [brief] = await db
      .select()
      .from(contentBriefsTable)
      .where(
        and(
          eq(contentBriefsTable.id, id),
          eq(contentBriefsTable.projectId, projectId),
          eq(contentBriefsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!brief) {
      res.status(404).json({ error: "Brief not found" });
      return;
    }

    let clusterLabel = "General";
    let clusterKeywords: string[] = [];

    if (brief.clusterId) {
      const [cluster] = await db
        .select({ label: keywordClustersTable.label })
        .from(keywordClustersTable)
        .where(
          and(
            eq(keywordClustersTable.id, brief.clusterId),
            eq(keywordClustersTable.projectId, projectId),
            eq(keywordClustersTable.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (cluster) clusterLabel = cluster.label;

      const kws = await db
        .select({ phrase: keywordsTable.phrase })
        .from(keywordsTable)
        .where(
          and(
            eq(keywordsTable.clusterId, brief.clusterId),
            eq(keywordsTable.projectId, projectId),
            eq(keywordsTable.tenantId, tenantId),
          ),
        )
        .limit(20);
      clusterKeywords = kws.map((k) => k.phrase);
    }

    const generated = await generateBriefWithAI(brief.title, clusterLabel, clusterKeywords);

    const [updated] = await db
      .update(contentBriefsTable)
      .set({ outline: generated, targetWordCount: generated.targetWordCount, status: "draft" })
      .where(
        and(
          eq(contentBriefsTable.id, id),
          eq(contentBriefsTable.projectId, projectId),
          eq(contentBriefsTable.tenantId, tenantId),
        ),
      )
      .returning();

    const taskId = await enqueueAiTask({
      tenantId,
      projectId,
      taskType: "brief",
      createdBy: userId,
      input: { briefId: id },
    });

    res.json({ brief: updated, taskId });
  },
);

router.post(
  "/projects/:projectId/briefs/:id/approve",
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

    const [updated] = await db
      .update(contentBriefsTable)
      .set({ status: "approved" })
      .where(
        and(
          eq(contentBriefsTable.id, id),
          eq(contentBriefsTable.projectId, projectId),
          eq(contentBriefsTable.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Brief not found" });
      return;
    }

    res.json(updated);
  },
);

export default router;
