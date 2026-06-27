import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  commentsTable,
  usersTable,
  projectsTable,
  keywordClustersTable,
  contentBriefsTable,
  keywordsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

const CommentBody = z.object({
  entityType: z.enum(["cluster", "brief", "project", "keyword"]),
  entityId: z.number().int().positive(),
  body: z.string().min(1).max(4000),
});

function parsePositiveQueryInt(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

async function assertEntityAccess(
  entityType: z.infer<typeof CommentBody>["entityType"],
  entityId: number,
  tenantId: number,
): Promise<boolean> {
  if (entityType === "project") {
    const [row] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, entityId), eq(projectsTable.tenantId, tenantId)))
      .limit(1);
    return !!row;
  }
  if (entityType === "cluster") {
    const [row] = await db
      .select({ id: keywordClustersTable.id })
      .from(keywordClustersTable)
      .where(
        and(eq(keywordClustersTable.id, entityId), eq(keywordClustersTable.tenantId, tenantId)),
      )
      .limit(1);
    return !!row;
  }
  if (entityType === "brief") {
    const [row] = await db
      .select({ id: contentBriefsTable.id })
      .from(contentBriefsTable)
      .where(and(eq(contentBriefsTable.id, entityId), eq(contentBriefsTable.tenantId, tenantId)))
      .limit(1);
    return !!row;
  }
  const [row] = await db
    .select({ id: keywordsTable.id })
    .from(keywordsTable)
    .where(and(eq(keywordsTable.id, entityId), eq(keywordsTable.tenantId, tenantId)))
    .limit(1);
  return !!row;
}

router.get("/comments", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const parsedEntityId = parsePositiveQueryInt(req.query.entityId);
  const parsedQuery = CommentBody.pick({ entityType: true, entityId: true }).safeParse({
    entityType: req.query.entityType,
    entityId: parsedEntityId,
  });

  if (!req.query.entityType || !req.query.entityId) {
    res.status(400).json({ error: "entityType and entityId required" });
    return;
  }
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid entityId" });
    return;
  }
  const { entityType, entityId } = parsedQuery.data;
  if (!(await assertEntityAccess(entityType, entityId, tenantId))) {
    res.status(404).json({ error: "Entity not found" });
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
        eq(commentsTable.entityType, entityType),
        eq(commentsTable.entityId, entityId),
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
  if (!(await assertEntityAccess(parsed.data.entityType, parsed.data.entityId, tenantId))) {
    res.status(404).json({ error: "Entity not found" });
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
    const id = parsePositiveRouteInt(req.params.id);
    if (id == null) {
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
  const id = parsePositiveRouteInt(req.params.id);
  if (id == null) {
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

  await db
    .delete(commentsTable)
    .where(and(eq(commentsTable.id, id), eq(commentsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

export default router;
