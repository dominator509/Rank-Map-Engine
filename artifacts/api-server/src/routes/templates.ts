import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, projectTemplatesTable, projectsTable, projectScoreSettingsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

const TemplateBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  config: z.record(z.unknown()).optional(),
});

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

router.get("/templates", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const templates = await db
    .select()
    .from(projectTemplatesTable)
    .where(eq(projectTemplatesTable.tenantId, tenantId))
    .orderBy(projectTemplatesTable.createdAt);
  res.json(templates);
});

router.post(
  "/templates",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const parsed = TemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const [template] = await db
      .insert(projectTemplatesTable)
      .values({ ...parsed.data, config: parsed.data.config ?? {}, tenantId, createdBy: userId })
      .returning();
    res.status(201).json(template);
  },
);

// Save project settings as a template
router.post(
  "/projects/:projectId/save-as-template",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);
    if (projectId == null) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }

    const { name, description } = z
      .object({ name: z.string().min(1), description: z.string().optional() })
      .parse(req.body);

    const [project] = await db
      .select()
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

    const [template] = await db
      .insert(projectTemplatesTable)
      .values({
        name,
        description,
        config: { scoreSettings: settings ?? {} },
        tenantId,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(template);
  },
);

router.patch(
  "/templates/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parsePositiveRouteInt(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = TemplateBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const [updated] = await db
      .update(projectTemplatesTable)
      .set(parsed.data)
      .where(and(eq(projectTemplatesTable.id, id), eq(projectTemplatesTable.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(updated);
  },
);

router.delete(
  "/templates/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parsePositiveRouteInt(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(projectTemplatesTable)
      .where(and(eq(projectTemplatesTable.id, id), eq(projectTemplatesTable.tenantId, tenantId)));
    res.json({ ok: true });
  },
);

export default router;
