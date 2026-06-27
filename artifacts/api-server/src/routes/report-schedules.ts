import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, reportSchedulesTable, projectsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

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

const ScheduleBody = z.object({
  projectId: z.number().int().positive(),
  reportType: z.enum(["project_summary", "topical_authority", "content_pipeline"]),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipientEmails: z.array(z.string().email()).min(1).max(20),
  isActive: z.boolean().optional(),
});

function nextSendAt(frequency: string): Date {
  const now = new Date();
  if (frequency === "daily") return new Date(now.getTime() + 86400000);
  if (frequency === "weekly") return new Date(now.getTime() + 7 * 86400000);
  return new Date(now.getTime() + 30 * 86400000);
}

router.get("/report-schedules", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const schedules = await db
    .select()
    .from(reportSchedulesTable)
    .where(eq(reportSchedulesTable.tenantId, tenantId))
    .orderBy(reportSchedulesTable.createdAt);
  res.json(schedules);
});

router.get(
  "/projects/:projectId/report-schedules",
  requireAuth,
  async (req, res): Promise<void> => {
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

    const schedules = await db
      .select()
      .from(reportSchedulesTable)
      .where(
        and(
          eq(reportSchedulesTable.projectId, projectId),
          eq(reportSchedulesTable.tenantId, tenantId),
        ),
      );
    res.json(schedules);
  },
);

router.post(
  "/report-schedules",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const parsed = ScheduleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    if (!(await assertProjectAccess(parsed.data.projectId, tenantId))) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [schedule] = await db
      .insert(reportSchedulesTable)
      .values({
        ...parsed.data,
        tenantId,
        recipientEmails: parsed.data.recipientEmails as unknown as never,
        nextSendAt: nextSendAt(parsed.data.frequency),
      })
      .returning();
    res.status(201).json(schedule);
  },
);

router.patch(
  "/report-schedules/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parsePositiveRouteInt(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = ScheduleBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    if (
      parsed.data.projectId !== undefined &&
      !(await assertProjectAccess(parsed.data.projectId, tenantId))
    ) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.frequency) updateData.nextSendAt = nextSendAt(parsed.data.frequency);
    if (parsed.data.recipientEmails) updateData.recipientEmails = parsed.data.recipientEmails;

    const [updated] = await db
      .update(reportSchedulesTable)
      .set(updateData as never)
      .where(and(eq(reportSchedulesTable.id, id), eq(reportSchedulesTable.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    res.json(updated);
  },
);

router.delete(
  "/report-schedules/:id",
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
      .delete(reportSchedulesTable)
      .where(and(eq(reportSchedulesTable.id, id), eq(reportSchedulesTable.tenantId, tenantId)));
    res.json({ ok: true });
  },
);

export default router;
