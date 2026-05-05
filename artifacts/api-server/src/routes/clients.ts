import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import { CreateClientBody, UpdateClientBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  const clients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tenantId));

  res.json(clients);
});

router.post(
  "/clients",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = CreateClientBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;

    const [client] = await db
      .insert(clientsTable)
      .values({ ...parsed.data, tenantId })
      .returning();

    res.status(201).json(client);
  },
);

router.get("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tenantId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  res.json(client);
});

router.patch(
  "/clients/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = UpdateClientBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const updates: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.name !== undefined) updates.name = d.name;
    if (d.domain !== undefined) updates.domain = d.domain;
    if (d.industry !== undefined) updates.industry = d.industry;
    if (d.logoUrl !== undefined) updates.logoUrl = d.logoUrl;
    if (d.isActive !== undefined) updates.isActive = d.isActive;

    const [updated] = await db
      .update(clientsTable)
      .set(updates)
      .where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    res.json(updated);
  },
);

router.delete(
  "/clients/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(clientsTable)
      .where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tenantId)));

    res.status(204).send();
  },
);

export default router;
