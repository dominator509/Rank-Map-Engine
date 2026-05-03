import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  keywordsTable,
  contentBriefsTable,
  auditLogTable,
  commentsTable,
  notificationsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { audit } from "../lib/audit.js";

const router = Router();

// Data export — GDPR right of access
router.get("/gdpr/export", requireAuth, async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName, role: usersTable.role, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
    .limit(1);

  const [myComments, myAuditLogs, myNotifications, myKeywords, myBriefs] = await Promise.all([
    db.select().from(commentsTable).where(and(eq(commentsTable.userId, userId), eq(commentsTable.tenantId, tenantId))),
    db.select().from(auditLogTable).where(and(eq(auditLogTable.userId, userId), eq(auditLogTable.tenantId, tenantId))),
    db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.tenantId, tenantId))),
    db.select().from(keywordsTable).where(eq(keywordsTable.tenantId, tenantId)),
    db.select().from(contentBriefsTable).where(eq(contentBriefsTable.tenantId, tenantId)),
  ]);

  await audit({ tenantId, userId, action: "gdpr.export", resourceType: "user", resourceId: userId, req });

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=\"my-data-export.json\"");
  res.json({
    exportedAt: new Date().toISOString(),
    user,
    comments: myComments,
    auditLogs: myAuditLogs,
    notifications: myNotifications,
    keywords: myKeywords,
    contentBriefs: myBriefs,
  });
});

// Account deletion — GDPR right to erasure
router.delete("/gdpr/me", requireAuth, requireRole(["agency_admin", "agency_user", "client_viewer", "super_admin"]), async (req, res): Promise<void> => {
  const { id: userId, tenantId } = req.session.user!;

  // Admins cannot self-delete via this endpoint — must transfer ownership first
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
    .limit(1);

  if (user?.role === "agency_admin") {
    res.status(422).json({ error: "Agency admins must transfer ownership before deleting their account. Contact support." });
    return;
  }

  await audit({ tenantId, userId, action: "gdpr.account_deletion", resourceType: "user", resourceId: userId, req });

  // Anonymise user data (keep audit trail rows, set foreign key safe values)
  await db
    .update(usersTable)
    .set({
      email: `deleted-${userId}@deleted.invalid`,
      fullName: "Deleted User",
      passwordHash: "DELETED",
      avatarUrl: null,
    })
    .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)));

  req.session.destroy(() => {});
  res.json({ ok: true, message: "Your account has been scheduled for deletion." });
});

export default router;
