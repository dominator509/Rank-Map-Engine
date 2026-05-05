import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, commentsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

const CommentBody = z.object({
  entityType: z.enum(["cluster", "brief", "project", "keyword"]),
  entityId: z.number().int().positive(),
  body: z.string().min(1).max(4000),
});

router.get("/comments", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const { entityType, entityId } = req.query;

  if (!entityType || !entityId) {
    res.status(400).json({ error: "entityType and entityId required" });
    return;
  }

  const eid = parseInt(entityId as string, 10);
  if (isNaN(eid)) {
    res.status(400).json({ error: "Invalid entityId" });
    return;
  }

  const rows = await db
    .select({
      id: commentsTable.id,
      body: commentsTable.body,
      entityType: commentsTable.entityType,
      entityId: commentsTable.entityId,
      resolvedAt: commentsTable.resolvedAt,
      createdAt: commentsTable.createdAt,
      updatedAt: commentsTable.updatedAt,
      user: {
        id: usersTable.id,
        fullName: usersTable.fullName,
        avatarUrl: usersTable.avatarUrl,
      },
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(
      and(
        eq(commentsTable.tenantId, tenantId),
        eq(commentsTable.entityType, entityType as string),
        eq(commentsTable.entityId, eid),
      ),
    )
    .orderBy(commentsTable.createdAt);

  res.json(rows);
});

router.post("/comments", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;
  const parsed = CommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({ ...parsed.data, userId, tenantId })
    .returning();
  res.status(201).json(comment);
});

router.patch(
  "/comments/:id/resolve",
  requireAuth,
  requireRole(["agency_admin", "agency_user", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [updated] = await db
      .update(commentsTable)
      .set({ resolvedAt: new Date() })
      .where(and(eq(commentsTable.id, id), eq(commentsTable.tenantId, tenantId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    res.json(updated);
  },
);

router.delete("/comments/:id", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select({ userId: commentsTable.userId })
    .from(commentsTable)
    .where(and(eq(commentsTable.id, id), eq(commentsTable.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  if (
    existing.userId !== userId &&
    !["agency_admin", "super_admin"].includes(req.session.user!.role)
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.id, id));
  res.json({ ok: true });
});

export default router;
