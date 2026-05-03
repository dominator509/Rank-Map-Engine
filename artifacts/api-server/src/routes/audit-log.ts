import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, auditLogTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.get(
  "/audit-log",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
    const offset = parseInt(req.query.offset as string || "0", 10);
    const resourceType = req.query.resourceType as string | undefined;
    const action = req.query.action as string | undefined;

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
