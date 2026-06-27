import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, aiTasksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

router.get("/ai-tasks", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;

  const tasks = await db
    .select()
    .from(aiTasksTable)
    .where(eq(aiTasksTable.tenantId, tenantId))
    .orderBy(aiTasksTable.createdAt);

  res.json(tasks);
});

router.get("/ai-tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const id = parsePositiveRouteInt(req.params.id);

  if (id == null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [task] = await db
    .select()
    .from(aiTasksTable)
    .where(and(eq(aiTasksTable.id, id), eq(aiTasksTable.tenantId, tenantId)))
    .limit(1);

  if (!task) {
    res.status(404).json({ error: "AI task not found" });
    return;
  }

  res.json(task);
});

export default router;
