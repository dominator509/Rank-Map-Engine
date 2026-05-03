import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, keywordClustersTable, keywordsTable, projectsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

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
  "/projects/:projectId/topic-map",
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

    const keywords = await db
      .select()
      .from(keywordsTable)
      .where(
        and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)),
      );

    const pillars = clusters
      .filter((c) => c.clusterType === "pillar" || c.pillarTopic)
      .map((pillar) => {
        const supporting = clusters.filter(
          (c) => c.pillarTopic === pillar.label && c.id !== pillar.id,
        );
        const pillarKws = keywords.filter((k) => k.clusterId === pillar.id);
        const avgScore =
          pillarKws.length > 0
            ? pillarKws.reduce((sum, k) => sum + (k.finalScore ?? 0), 0) / pillarKws.length
            : 0;

        return {
          id: pillar.id,
          label: pillar.label,
          pillarTopic: pillar.pillarTopic,
          authorityScore: Math.round(avgScore * 100),
          keywordCount: pillarKws.length,
          supporting: supporting.map((s) => ({
            id: s.id,
            label: s.label,
            status: s.status,
            keywordCount: keywords.filter((k) => k.clusterId === s.id).length,
          })),
        };
      });

    const ungrouped = clusters
      .filter((c) => !c.pillarTopic && c.clusterType !== "pillar")
      .map((c) => ({
        id: c.id,
        label: c.label,
        status: c.status,
        keywordCount: keywords.filter((k) => k.clusterId === c.id).length,
      }));

    res.json({ pillars, ungrouped, totalKeywords: keywords.length });
  },
);

router.get(
  "/projects/:projectId/roadmap",
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

    const keywords = await db
      .select()
      .from(keywordsTable)
      .where(
        and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)),
      );

    const roadmap = clusters
      .sort((a, b) => {
        const aKws = keywords.filter((k) => k.clusterId === a.id);
        const bKws = keywords.filter((k) => k.clusterId === b.id);
        const aScore = aKws.reduce((sum, k) => sum + (k.finalScore ?? 0), 0);
        const bScore = bKws.reduce((sum, k) => sum + (k.finalScore ?? 0), 0);
        return bScore - aScore;
      })
      .map((c, idx) => ({
        rank: idx + 1,
        clusterId: c.id,
        label: c.label,
        pillarTopic: c.pillarTopic,
        clusterType: c.clusterType,
        status: c.status,
        keywordCount: keywords.filter((k) => k.clusterId === c.id).length,
        avgScore:
          keywords.filter((k) => k.clusterId === c.id).length > 0
            ? Math.round(
                (keywords
                  .filter((k) => k.clusterId === c.id)
                  .reduce((sum, k) => sum + (k.finalScore ?? 0), 0) /
                  keywords.filter((k) => k.clusterId === c.id).length) *
                  100,
              ) / 100
            : 0,
      }));

    res.json(roadmap);
  },
);

export default router;
