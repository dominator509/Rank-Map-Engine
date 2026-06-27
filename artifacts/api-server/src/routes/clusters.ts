import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, keywordClustersTable, keywordsTable, projectsTable } from "@workspace/db";
import { CreateClusterBody, UpdateClusterBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { enqueueAiTask } from "../lib/ai.js";
import { clusterKeywordsWithAI } from "../lib/ai-provider.js";
import { audit } from "../lib/audit.js";
import { emitWebhookEvent } from "../lib/webhook-emitter.js";

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

router.get("/projects/:projectId/clusters", requireAuth, async (req, res): Promise<void> => {
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

  const clusters = await db
    .select()
    .from(keywordClustersTable)
    .where(
      and(
        eq(keywordClustersTable.projectId, projectId),
        eq(keywordClustersTable.tenantId, tenantId),
      ),
    );

  res.json(clusters);
});

router.post(
  "/projects/:projectId/clusters",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = CreateClusterBody.safeParse(req.body);
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

    const [cluster] = await db
      .insert(keywordClustersTable)
      .values({
        ...parsed.data,
        projectId,
        tenantId,
        status: "pending",
      })
      .returning();

    res.status(201).json(cluster);
  },
);

router.post(
  "/projects/:projectId/clusters/auto",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);

    if (projectId == null) {
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

    if (keywords.length === 0) {
      res.status(400).json({ error: "No keywords to cluster" });
      return;
    }

    const aiResults = await clusterKeywordsWithAI(
      keywords.map((k) => ({ id: k.id, phrase: k.phrase })),
    );
    const allowedKeywordIds = new Set(keywords.map((k) => k.id));

    const clusters: Array<typeof keywordClustersTable.$inferSelect> = [];
    for (const group of aiResults) {
      const keywordIds = Array.from(
        new Set(group.keywordIds.filter((id) => allowedKeywordIds.has(id))),
      );
      if (keywordIds.length === 0) continue;

      const [cluster] = await db
        .insert(keywordClustersTable)
        .values({
          label: group.label,
          projectId,
          tenantId,
          clusterType: "cluster",
          status: "pending",
        })
        .returning();

      await db
        .update(keywordsTable)
        .set({ clusterId: cluster.id })
        .where(
          and(
            inArray(keywordsTable.id, keywordIds),
            eq(keywordsTable.projectId, projectId),
            eq(keywordsTable.tenantId, tenantId),
          ),
        );

      clusters.push(cluster);
    }

    const taskId = await enqueueAiTask({
      tenantId,
      projectId,
      taskType: "cluster",
      createdBy: userId,
      input: {
        clusterIds: clusters.map((c) => c.id),
        provider: process.env.OPENAI_API_KEY ? "openai" : "mock",
      },
    });

    await audit({
      tenantId,
      userId,
      action: "cluster.auto_clustered",
      resourceType: "project",
      resourceId: projectId,
      metadata: {
        clusterCount: clusters.length,
        provider: process.env.OPENAI_API_KEY ? "openai" : "mock",
      },
      req,
    });

    await emitWebhookEvent(tenantId, "cluster.created", {
      projectId,
      clusterCount: clusters.length,
    });

    res.status(201).json({ clusters, taskId });
  },
);

router.get("/projects/:projectId/clusters/:id", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parsePositiveRouteInt(req.params.projectId);
  const id = parsePositiveRouteInt(req.params.id);

  if (projectId == null || id == null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [cluster] = await db
    .select()
    .from(keywordClustersTable)
    .where(
      and(
        eq(keywordClustersTable.id, id),
        eq(keywordClustersTable.projectId, projectId),
        eq(keywordClustersTable.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!cluster) {
    res.status(404).json({ error: "Cluster not found" });
    return;
  }

  const keywords = await db
    .select()
    .from(keywordsTable)
    .where(
      and(
        eq(keywordsTable.clusterId, id),
        eq(keywordsTable.projectId, projectId),
        eq(keywordsTable.tenantId, tenantId),
      ),
    );

  res.json({ ...cluster, keywords });
});

router.patch(
  "/projects/:projectId/clusters/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = UpdateClusterBody.safeParse(req.body);
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
    if (d.label !== undefined) updates.label = d.label;
    if (d.pillarTopic !== undefined) updates.pillarTopic = d.pillarTopic;
    if (d.clusterType !== undefined) updates.clusterType = d.clusterType;

    const [updated] = await db
      .update(keywordClustersTable)
      .set(updates)
      .where(
        and(
          eq(keywordClustersTable.id, id),
          eq(keywordClustersTable.projectId, projectId),
          eq(keywordClustersTable.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Cluster not found" });
      return;
    }

    res.json(updated);
  },
);

router.delete(
  "/projects/:projectId/clusters/:id",
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
      .update(keywordsTable)
      .set({ clusterId: null })
      .where(
        and(
          eq(keywordsTable.clusterId, id),
          eq(keywordsTable.projectId, projectId),
          eq(keywordsTable.tenantId, tenantId),
        ),
      );

    await db
      .delete(keywordClustersTable)
      .where(
        and(
          eq(keywordClustersTable.id, id),
          eq(keywordClustersTable.projectId, projectId),
          eq(keywordClustersTable.tenantId, tenantId),
        ),
      );

    res.status(204).send();
  },
);

router.post(
  "/projects/:projectId/clusters/:id/approve",
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

    const [updated] = await db
      .update(keywordClustersTable)
      .set({ status: "approved" })
      .where(
        and(
          eq(keywordClustersTable.id, id),
          eq(keywordClustersTable.projectId, projectId),
          eq(keywordClustersTable.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Cluster not found" });
      return;
    }

    res.json(updated);
  },
);

router.post(
  "/projects/:projectId/clusters/:id/reject",
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

    const [updated] = await db
      .update(keywordClustersTable)
      .set({ status: "rejected" })
      .where(
        and(
          eq(keywordClustersTable.id, id),
          eq(keywordClustersTable.projectId, projectId),
          eq(keywordClustersTable.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Cluster not found" });
      return;
    }

    res.json(updated);
  },
);

export default router;
