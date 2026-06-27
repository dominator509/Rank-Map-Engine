import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  contentBriefsTable,
  contentCalendarEntriesTable,
  projectsTable,
  usersTable,
} from "@workspace/db";
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

async function assertBriefAccess(briefId: number, projectId: number, tenantId: number) {
  const [brief] = await db
    .select({ id: contentBriefsTable.id })
    .from(contentBriefsTable)
    .where(
      and(
        eq(contentBriefsTable.id, briefId),
        eq(contentBriefsTable.projectId, projectId),
        eq(contentBriefsTable.tenantId, tenantId),
      ),
    )
    .limit(1);
  return !!brief;
}

async function assertUserAccess(userId: number, tenantId: number) {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
    .limit(1);
  return !!user;
}

async function validateEntryRelations(
  body: { briefId?: number | null; assignedTo?: number | null },
  projectId: number,
  tenantId: number,
): Promise<string | null> {
  if (body.briefId != null && !(await assertBriefAccess(body.briefId, projectId, tenantId))) {
    return "Invalid briefId";
  }

  if (body.assignedTo != null && !(await assertUserAccess(body.assignedTo, tenantId))) {
    return "Invalid assignedTo";
  }

  return null;
}

function parseCalendarMonthFilter(
  month: unknown,
  year: unknown,
): { start: string; end: string } | null | undefined {
  if (month == null && year == null) return undefined;
  if (typeof month !== "string" || typeof year !== "string") return null;
  if (!/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;

  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  if (parsedMonth < 1 || parsedMonth > 12 || !Number.isSafeInteger(parsedYear)) return null;

  const monthText = String(parsedMonth).padStart(2, "0");
  const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
  return {
    start: `${parsedYear}-${monthText}-01`,
    end: `${parsedYear}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
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
  const projectId = parsePositiveRouteInt(req.params.projectId);
  if (projectId == null) {
    res.status(400).json({ error: "Invalid projectId" });
    return;
  }
  if (!(await assertProjectAccess(projectId, tenantId))) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { month, year } = req.query;
  let conditions = and(
    eq(contentCalendarEntriesTable.projectId, projectId),
    eq(contentCalendarEntriesTable.tenantId, tenantId),
  );

  const monthFilter = parseCalendarMonthFilter(month, year);
  if (monthFilter === null) {
    res.status(400).json({ error: "Invalid month/year filter" });
    return;
  }

  if (monthFilter) {
    conditions = and(
      conditions,
      gte(contentCalendarEntriesTable.dueDate, monthFilter.start),
      lte(contentCalendarEntriesTable.dueDate, monthFilter.end),
    );
  }

  const entries = await db
    .select()
    .from(contentCalendarEntriesTable)
    .where(conditions)
    .orderBy(contentCalendarEntriesTable.dueDate);
  res.json(entries);
});

router.post(
  "/projects/:projectId/calendar",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
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

    const parsed = EntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const relationError = await validateEntryRelations(parsed.data, projectId, tenantId);
    if (relationError) {
      res.status(400).json({ error: relationError });
      return;
    }

    const [entry] = await db
      .insert(contentCalendarEntriesTable)
      .values({ ...parsed.data, projectId, tenantId })
      .returning();
    res.status(201).json(entry);
  },
);

router.patch(
  "/projects/:projectId/calendar/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);
    const id = parsePositiveRouteInt(req.params.id);
    if (projectId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = EntryBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const relationError = await validateEntryRelations(parsed.data, projectId, tenantId);
    if (relationError) {
      res.status(400).json({ error: relationError });
      return;
    }

    const [updated] = await db
      .update(contentCalendarEntriesTable)
      .set(parsed.data)
      .where(
        and(
          eq(contentCalendarEntriesTable.id, id),
          eq(contentCalendarEntriesTable.projectId, projectId),
          eq(contentCalendarEntriesTable.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(updated);
  },
);

router.delete(
  "/projects/:projectId/calendar/:id",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const projectId = parsePositiveRouteInt(req.params.projectId);
    const id = parsePositiveRouteInt(req.params.id);
    if (projectId == null || id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(contentCalendarEntriesTable)
      .where(
        and(
          eq(contentCalendarEntriesTable.id, id),
          eq(contentCalendarEntriesTable.projectId, projectId),
          eq(contentCalendarEntriesTable.tenantId, tenantId),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;
