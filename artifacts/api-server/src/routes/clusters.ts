import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, keywordClustersTable, keywordsTable, projectsTable, aiTasksTable } from "@workspace/db";
import { CreateClusterBody, UpdateClusterBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { enqueueAiTask } from "../lib/ai.js";
import { clusterKeywordsWithAI } from "../lib/ai-provider.js";
import { audit } from "../lib/audit.js";
import { emitWebhookEvent } from "../lib/webhook-emitter.js";

const router = Router();

async function assertProjectAccess(projectId: number, tenantId: number) {
  const [p] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
    .limit(1);
  return !!p;
}

router.get(
  "/projects/:projectId/clusters",
  requireAuth,
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
  },
);

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
    const projectId = parseInt(req.params.projectId as string, 10);

    if (isNaN(projectId)) {
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
      .where(
        and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)),
      );

    if (keywords.length === 0) {
      res.status(400).json({ error: "No keywords to cluster" });
      return;
    }

    const aiResults = await clusterKeywordsWithAI(
      keywords.map((k) => ({ id: k.id, phrase: k.phrase })),
    );

    const clusters: Array<typeof keywordClustersTable.$inferSelect> = [];
    for (const group of aiResults) {
      if (group.keywordIds.length === 0) continue;
      const [cluster] = await db
        .insert(keywordClustersTable)
        .values({ label: group.label, projectId, tenantId, clusterType: "cluster", status: "pending" })
        .returning();

      await db
        .update(keywordsTable)
        .set({ clusterId: cluster.id })
        .where(inArray(keywordsTable.id, group.keywordIds));

      clusters.push(cluster);
    }

    const taskId = await enqueueAiTask({
      tenantId,
      projectId,
      taskType: "cluster",
      createdBy: userId,
      input: { clusterIds: clusters.map((c) => c.id), provider: process.env.OPENAI_API_KEY ? "openai" : "mock" },
    });

    await audit({
      tenantId, userId, action: "cluster.auto_clustered", resourceType: "project", resourceId: projectId,
      metadata: { clusterCount: clusters.length, provider: process.env.OPENAI_API_KEY ? "openai" : "mock" }, req,
    });

    await emitWebhookEvent(tenantId, "cluster.created", { projectId, clusterCount: clusters.length });

    res.status(201).json({ clusters, taskId });
  },
);

router.get(
  "/projects/:projectId/clusters/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parseInt(req.params.projectId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(projectId) || isNaN(id)) {
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
      .where(eq(keywordsTable.clusterId, id));

    res.json({ ...cluster, keywords });
  },
);

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
    const projectId = parseInt(req.params.projectId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(projectId) || isNaN(id)) {
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
    const projectId = parseInt(req.params.projectId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(projectId) || isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .update(keywordsTable)
      .set({ clusterId: null })
      .where(eq(keywordsTable.clusterId, id));

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
    const projectId = parseInt(req.params.projectId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(projectId) || isNaN(id)) {
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
    const projectId = parseInt(req.params.projectId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(projectId) || isNaN(id)) {
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
