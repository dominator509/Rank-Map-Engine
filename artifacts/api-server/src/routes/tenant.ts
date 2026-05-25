import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  tenantsTable,
  clientsTable,
  projectsTable,
  keywordsTable,
  keywordClustersTable,
  contentBriefsTable,
  aiTasksTable,
} from "@workspace/db";
import { UpdateMyTenantBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
const WHITE_LABEL_MAX_DEPTH = 20;
const WHITE_LABEL_MAX_JSON_LENGTH = 10_000;

function withinWhiteLabelLimits(value: unknown, depth = 0): boolean {
  if (value === null) return true;
  if (typeof value !== "object") return true;
  if (depth >= WHITE_LABEL_MAX_DEPTH) return false;
  if (Array.isArray(value)) {
    return value.every((item) => withinWhiteLabelLimits(item, depth + 1));
  }
  return Object.values(value as Record<string, unknown>).every((child) =>
    withinWhiteLabelLimits(child, depth + 1),
  );
}

router.get("/tenant", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  res.json(tenant);
});

router.patch(
  "/tenant",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = UpdateMyTenantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const updates: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.whiteLabelConfig !== undefined) {
      const serialized = JSON.stringify(parsed.data.whiteLabelConfig);
      if (serialized.length > WHITE_LABEL_MAX_JSON_LENGTH) {
        res.status(400).json({ error: "whiteLabelConfig payload too large" });
        return;
      }
      if (!withinWhiteLabelLimits(parsed.data.whiteLabelConfig)) {
        res.status(400).json({ error: "whiteLabelConfig nesting depth exceeds limit" });
        return;
      }
      updates.whiteLabelConfig = parsed.data.whiteLabelConfig;
    }

    const [updated] = await db
      .update(tenantsTable)
      .set(updates)
      .where(eq(tenantsTable.id, tenantId))
      .returning();

    res.json(updated);
  },
);

router.get("/tenant/dashboard", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  const [
    clientCount,
    projectCount,
    keywordCount,
    clusterCount,
    briefCount,
    pendingApprovals,
    aiTasksThisMonth,
  ] = await Promise.all([
    db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.tenantId, tenantId))
      .then((r) => r.length),
    db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.tenantId, tenantId))
      .then((r) => r.length),
    db
      .select({ id: keywordsTable.id })
      .from(keywordsTable)
      .where(eq(keywordsTable.tenantId, tenantId))
      .then((r) => r.length),
    db
      .select({ id: keywordClustersTable.id })
      .from(keywordClustersTable)
      .where(eq(keywordClustersTable.tenantId, tenantId))
      .then((r) => r.length),
    db
      .select({ id: contentBriefsTable.id })
      .from(contentBriefsTable)
      .where(eq(contentBriefsTable.tenantId, tenantId))
      .then((r) => r.length),
    db
      .select({ id: aiTasksTable.id })
      .from(aiTasksTable)
      .where(and(eq(aiTasksTable.tenantId, tenantId), eq(aiTasksTable.status, "awaiting_approval")))
      .then((r) => r.length),
    db
      .select({ id: aiTasksTable.id })
      .from(aiTasksTable)
      .where(eq(aiTasksTable.tenantId, tenantId))
      .then((r) => r.length),
  ]);

  res.json({
    clientCount,
    projectCount,
    keywordCount,
    clusterCount,
    briefCount,
    pendingApprovals,
    aiTasksThisMonth,
  });
});

export default router;
