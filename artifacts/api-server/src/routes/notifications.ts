import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.tenantId, tenantId)))
    .orderBy(notificationsTable.createdAt);
  res.json(rows.reverse());
});

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;
  const rows = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.tenantId, tenantId),
        isNull(notificationsTable.readAt),
      ),
    );
  res.json({ count: rows.length });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId), eq(notificationsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(eq(notificationsTable.userId, userId), eq(notificationsTable.tenantId, tenantId), isNull(notificationsTable.readAt)),
    );
  res.json({ ok: true });
});

router.delete("/notifications/:id", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId), eq(notificationsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

export async function createNotification(params: {
  tenantId: number;
  userId: number;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  try {
    await db.insert(notificationsTable).values(params);
  } catch {
    // notification failures should never crash the main request
  }
}

export default router;
