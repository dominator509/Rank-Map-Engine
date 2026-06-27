import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, auditLogTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

function parsePaginationInt(
  value: unknown,
  fallback: number,
  options: { min: number; max: number },
): number | null {
  const raw = value === undefined ? String(fallback) : String(value);
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < options.min || parsed > options.max) return null;
  return parsed;
}

router.get(
  "/audit-log",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const limit = parsePaginationInt(req.query.limit, 50, { min: 1, max: 200 });
    const offset = parsePaginationInt(req.query.offset, 0, { min: 0, max: 10_000 });
    const resourceType = req.query.resourceType as string | undefined;
    const action = req.query.action as string | undefined;
    if (limit == null || offset == null) {
      res.status(400).json({ error: "Invalid pagination" });
      return;
    }

    const conditions = [eq(auditLogTable.tenantId, tenantId)];
    if (resourceType) conditions.push(eq(auditLogTable.resourceType, resourceType));
    if (action) conditions.push(eq(auditLogTable.action, action));

    const logs = await db
      .select({
        id: auditLogTable.id,
        action: auditLogTable.action,
        resourceType: auditLogTable.resourceType,
        resourceId: auditLogTable.resourceId,
        metadata: auditLogTable.metadata,
        ipAddress: auditLogTable.ipAddress,
        createdAt: auditLogTable.createdAt,
        userName: usersTable.fullName,
        userEmail: usersTable.email,
      })
      .from(auditLogTable)
      .leftJoin(usersTable, eq(auditLogTable.userId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(logs);
  },
);

export default router;
