import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, projectsTable, projectScoreSettingsTable, clientsTable } from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  UpdateScoreSettingsBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const clientIdRaw = req.query.clientId;
  const clientId = clientIdRaw ? parseInt(clientIdRaw as string, 10) : undefined;

  const conditions = [eq(projectsTable.tenantId, tenantId)];
  if (clientId && !isNaN(clientId)) {
    conditions.push(eq(projectsTable.clientId, clientId));
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(and(...conditions));

  res.json(projects);
});

router.post(
  "/projects",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const { clientId, ...rest } = parsed.data;

    const [client] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.tenantId, tenantId)))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const [project] = await db
      .insert(projectsTable)
      .values({ ...rest, clientId, tenantId })
      .returning();

    await db.insert(projectScoreSettingsTable).values({ projectId: project.id });

    res.status(201).json(project);
  },
);

router.get("/clients/:clientId/projects", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const clientId = parseInt(req.params.clientId as string, 10);

  if (isNaN(clientId)) {
    res.status(400).json({ error: "Invalid clientId" });
    return;
  }

  const [client] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, clientId), eq(clientsTable.tenantId, tenantId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.clientId, clientId), eq(projectsTable.tenantId, tenantId)));

  res.json(projects);
});

router.post(
  "/clients/:clientId/projects",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = CreateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const clientId = parseInt(req.params.clientId as string, 10);

    if (isNaN(clientId)) {
      res.status(400).json({ error: "Invalid clientId" });
      return;
    }

    const [client] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.tenantId, tenantId)))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const [project] = await db
      .insert(projectsTable)
      .values({ ...parsed.data, clientId, tenantId })
      .returning();

    await db.insert(projectScoreSettingsTable).values({ projectId: project.id });

    res.status(201).json(project);
  },
);

router.get(
  "/clients/:clientId/projects/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const clientId = parseInt(req.params.clientId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(clientId) || isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, id),
          eq(projectsTable.clientId, clientId),
          eq(projectsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(project);
  },
);

router.patch(
  "/clients/:clientId/projects/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = UpdateProjectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { tenantId } = req.session.user!;
    const clientId = parseInt(req.params.clientId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(clientId) || isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const updates: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.name !== undefined) updates.name = d.name;
    if (d.targetDomain !== undefined) updates.targetDomain = d.targetDomain;
    if (d.locale !== undefined) updates.locale = d.locale;
    if (d.status !== undefined) updates.status = d.status;

    const [updated] = await db
      .update(projectsTable)
      .set(updates)
      .where(
        and(
          eq(projectsTable.id, id),
          eq(projectsTable.clientId, clientId),
          eq(projectsTable.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(updated);
  },
);

router.delete(
  "/clients/:clientId/projects/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const clientId = parseInt(req.params.clientId as string, 10);
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(clientId) || isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(projectsTable)
      .where(
        and(
          eq(projectsTable.id, id),
          eq(projectsTable.clientId, clientId),
          eq(projectsTable.tenantId, tenantId),
        ),
      );

    res.status(204).send();
  },
);

router.get(
  "/projects/:projectId/score-settings",
  requireAuth,
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parseInt(req.params.projectId as string, 10);

    if (isNaN(projectId)) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }

    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [settings] = await db
      .select()
      .from(projectScoreSettingsTable)
      .where(eq(projectScoreSettingsTable.projectId, projectId))
      .limit(1);

    res.json(settings ?? null);
  },
);

router.patch(
  "/projects/:projectId/score-settings",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const parsed = UpdateScoreSettingsBody.safeParse(req.body);
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

    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.volumeWeight !== undefined) updates.volumeWeight = String(d.volumeWeight);
    if (d.kdWeight !== undefined) updates.kdWeight = String(d.kdWeight);
    if (d.intentWeight !== undefined) updates.intentWeight = String(d.intentWeight);
    if (d.cpcWeight !== undefined) updates.cpcWeight = String(d.cpcWeight);
    if (d.freshnessWeight !== undefined) updates.freshnessWeight = String(d.freshnessWeight);

    const [updated] = await db
      .update(projectScoreSettingsTable)
      .set(updates)
      .where(eq(projectScoreSettingsTable.projectId, projectId))
      .returning();

    res.json(updated);
  },
);

export default router;
