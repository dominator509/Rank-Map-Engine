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

router.get("/projects/:projectId/topic-map", requireAuth, async (req, res): Promise<void> => {
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
    .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

  const clustersWithStats = clusters.map((cluster) => {
    const clusterKeywords = keywords.filter((keyword) => keyword.clusterId === cluster.id);
    const avgScore =
      clusterKeywords.length > 0
        ? clusterKeywords.reduce((sum, keyword) => sum + (keyword.finalScore ?? 0), 0) /
          clusterKeywords.length
        : null;

    return {
      ...cluster,
      keywordCount: clusterKeywords.length,
      avgScore,
    };
  });

  const pillars = clustersWithStats
    .filter((c) => c.clusterType === "pillar")
    .map((pillar) => {
      const supporting = clustersWithStats.filter(
        (c) => c.pillarTopic === pillar.label && c.id !== pillar.id,
      );

      return {
        id: pillar.id,
        label: pillar.label,
        keywordCount: pillar.keywordCount,
        clusters: supporting,
      };
    });

  const ungrouped = clustersWithStats
    .filter((c) => !c.pillarTopic && c.clusterType !== "pillar")
    .map((c) => c);

  const totalClusters = clusters.length;
  const approvedClusters = clusters.filter((cluster) => cluster.status === "approved").length;
  const authorityScore = totalClusters > 0 ? approvedClusters / totalClusters : 0;

  res.json({
    projectId,
    authorityScore,
    totalClusters,
    approvedClusters,
    pillars,
    ungrouped,
    totalKeywords: keywords.length,
  });
});

router.get("/projects/:projectId/roadmap", requireAuth, async (req, res): Promise<void> => {
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
    .where(and(eq(keywordsTable.projectId, projectId), eq(keywordsTable.tenantId, tenantId)));

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
});

export default router;
