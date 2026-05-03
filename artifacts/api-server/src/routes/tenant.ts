import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, usersTable, clientsTable, projectsTable, keywordsTable } from "@workspace/db";
import { UpdateMyTenantBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

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
    if (parsed.data.whiteLabelConfig !== undefined) updates.whiteLabelConfig = parsed.data.whiteLabelConfig;

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

  const [clientCount, projectCount, keywordCount, userCount] = await Promise.all([
    db
      .select({ count: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.tenantId, tenantId))
      .then((rows) => rows.length),
    db
      .select({ count: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.tenantId, tenantId))
      .then((rows) => rows.length),
    db
      .select({ count: keywordsTable.id })
      .from(keywordsTable)
      .where(eq(keywordsTable.tenantId, tenantId))
      .then((rows) => rows.length),
    db
      .select({ count: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.tenantId, tenantId))
      .then((rows) => rows.length),
  ]);

  res.json({ clientCount, projectCount, keywordCount, userCount });
});

export default router;
