import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, userInvitationsTable, tenantsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { audit } from "../lib/audit.js";
import { hasControlChars } from "../lib/input-guards.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const router = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function buildInviteUrl(token: string): string {
  const baseUrl = process.env.APP_URL;
  if (!baseUrl) {
    return `/accept-invite?token=${token}`;
  }

  try {
    return new URL(`/accept-invite?token=${token}`, baseUrl).toString();
  } catch {
    return `/accept-invite?token=${token}`;
  }
}

router.get("/team", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const members = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
      avatarUrl: usersTable.avatarUrl,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.tenantId, tenantId));
  res.json(members);
});

router.patch(
  "/team/:userId",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: currentUserId } = req.session.user!;
    const userId = parsePositiveRouteInt(req.params.userId);
    const { role } = req.body as { role?: string };

    if (userId == null) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    if (!role || !["agency_admin", "agency_user", "client"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const [member] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ role })
      .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
      .returning();

    await audit({
      tenantId,
      userId: currentUserId,
      action: "team.role_changed",
      resourceType: "user",
      resourceId: userId,
      metadata: { newRole: role },
      req,
    });

    res.json(updated);
  },
);

router.delete(
  "/team/:userId",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: currentUserId } = req.session.user!;
    const userId = parsePositiveRouteInt(req.params.userId);

    if (userId == null) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    if (userId === currentUserId) {
      res.status(400).json({ error: "Cannot remove yourself" });
      return;
    }

    const [member] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
      .limit(1);

    if (!member) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db
      .delete(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)));

    await audit({
      tenantId,
      userId: currentUserId,
      action: "team.member_removed",
      resourceType: "user",
      resourceId: userId,
      req,
    });

    res.status(204).send();
  },
);

router.post(
  "/team/invite",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: invitedBy } = req.session.user!;
    const { email, role = "agency_user" } = req.body as { email?: string; role?: string };

    if (!email || hasControlChars(email) || !EMAIL_PATTERN.test(email)) {
      res.status(400).json({ error: "Valid email required" });
      return;
    }

    if (!["agency_admin", "agency_user", "client"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.email, email.toLowerCase()), eq(usersTable.tenantId, tenantId)))
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: "User with this email already exists" });
      return;
    }

    const [tenant] = await db
      .select({ seatsUsed: tenantsTable.seatsUsed, seatsMax: tenantsTable.seatsMax })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1);

    if (tenant && tenant.seatsUsed >= tenant.seatsMax) {
      res
        .status(402)
        .json({ error: "Seat limit reached. Upgrade your plan to invite more members." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [existing] = await db
      .select({ id: userInvitationsTable.id })
      .from(userInvitationsTable)
      .where(
        and(
          eq(userInvitationsTable.email, email.toLowerCase()),
          eq(userInvitationsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (existing) {
      await db.delete(userInvitationsTable).where(eq(userInvitationsTable.id, existing.id));
    }

    const [invitation] = await db
      .insert(userInvitationsTable)
      .values({
        tenantId,
        email: email.toLowerCase(),
        role,
        token,
        invitedBy,
        expiresAt,
      })
      .returning();

    await audit({
      tenantId,
      userId: invitedBy,
      action: "team.invite_sent",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { email, role },
      req,
    });

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      inviteUrl: buildInviteUrl(token),
    });
  },
);

router.get(
  "/team/invitations",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const invitations = await db
      .select()
      .from(userInvitationsTable)
      .where(and(eq(userInvitationsTable.tenantId, tenantId)));
    res.json(invitations);
  },
);

router.delete(
  "/team/invitations/:id",
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
      .delete(userInvitationsTable)
      .where(and(eq(userInvitationsTable.id, id), eq(userInvitationsTable.tenantId, tenantId)));
    res.status(204).send();
  },
);

router.post("/team/invitations/accept", async (req, res): Promise<void> => {
  const { token, fullName, password } = req.body as {
    token?: string;
    fullName?: string;
    password?: string;
  };

  if (!token || !fullName || !password) {
    res.status(400).json({ error: "token, fullName, and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [invitation] = await db
    .select()
    .from(userInvitationsTable)
    .where(eq(userInvitationsTable.token, token))
    .limit(1);

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found or already used" });
    return;
  }

  if (invitation.acceptedAt) {
    res.status(409).json({ error: "Invitation already accepted" });
    return;
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    res.status(410).json({ error: "Invitation has expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({
      tenantId: invitation.tenantId,
      email: invitation.email,
      passwordHash,
      role: invitation.role,
      fullName,
    })
    .returning();

  await db
    .update(userInvitationsTable)
    .set({ acceptedAt: new Date() })
    .where(eq(userInvitationsTable.id, invitation.id));

  const allMembers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.tenantId, invitation.tenantId));
  await db
    .update(tenantsTable)
    .set({ seatsUsed: allMembers.length })
    .where(eq(tenantsTable.id, invitation.tenantId));

  req.session.user = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  };

  res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
});

export default router;
