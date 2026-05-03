import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db, contentCalendarEntriesTable, projectsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

async function assertProjectAccess(projectId: number, tenantId: number) {
  const [p] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.tenantId, tenantId)))
    .limit(1);
  return !!p;
}

const EntryBody = z.object({
  title: z.string().min(1),
  status: z.enum(["planned", "in_progress", "review", "published"]).default("planned"),
  dueDate: z.string().nullable().optional(),
  publishedDate: z.string().nullable().optional(),
  assignedTo: z.number().int().nullable().optional(),
  briefId: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get("/projects/:projectId/calendar", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }
  if (!(await assertProjectAccess(projectId, tenantId))) { res.status(404).json({ error: "Project not found" }); return; }

  const { month, year } = req.query;
  let conditions = and(
    eq(contentCalendarEntriesTable.projectId, projectId),
    eq(contentCalendarEntriesTable.tenantId, tenantId),
  );

  if (month && year) {
    const y = parseInt(year as string, 10);
    const m = parseInt(month as string, 10);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = `${y}-${String(m).padStart(2, "0")}-31`;
    conditions = and(conditions, gte(contentCalendarEntriesTable.dueDate, start), lte(contentCalendarEntriesTable.dueDate, end));
  }

  const entries = await db.select().from(contentCalendarEntriesTable).where(conditions).orderBy(contentCalendarEntriesTable.dueDate);
  res.json(entries);
});

router.post("/projects/:projectId/calendar", requireAuth, requireRole(["agency_admin", "agency_user", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid projectId" }); return; }
  if (!(await assertProjectAccess(projectId, tenantId))) { res.status(404).json({ error: "Project not found" }); return; }

  const parsed = EntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }

  const [entry] = await db
    .insert(contentCalendarEntriesTable)
    .values({ ...parsed.data, projectId, tenantId })
    .returning();
  res.status(201).json(entry);
});

router.patch("/projects/:projectId/calendar/:id", requireAuth, requireRole(["agency_admin", "agency_user", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(projectId) || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = EntryBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }

  const [updated] = await db
    .update(contentCalendarEntriesTable)
    .set(parsed.data)
    .where(and(eq(contentCalendarEntriesTable.id, id), eq(contentCalendarEntriesTable.projectId, projectId), eq(contentCalendarEntriesTable.tenantId, tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json(updated);
});

router.delete("/projects/:projectId/calendar/:id", requireAuth, requireRole(["agency_admin", "agency_user", "super_admin"]), async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const projectId = parseInt(req.params.projectId as string, 10);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(projectId) || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .delete(contentCalendarEntriesTable)
    .where(and(eq(contentCalendarEntriesTable.id, id), eq(contentCalendarEntriesTable.projectId, projectId), eq(contentCalendarEntriesTable.tenantId, tenantId)));
  res.json({ ok: true });
});

export default router;
