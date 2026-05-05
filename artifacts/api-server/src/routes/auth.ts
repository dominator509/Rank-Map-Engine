import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { email, password, fullName, tenantName } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [tenant] = await db
    .insert(tenantsTable)
    .values({ name: tenantName, plan: "solo", seatsUsed: 1, seatsMax: 1 })
    .returning();

  const [user] = await db
    .insert(usersTable)
    .values({
      tenantId: tenant.id,
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role: "agency_admin",
    })
    .returning({
      id: usersTable.id,
      tenantId: usersTable.tenantId,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
      avatarUrl: usersTable.avatarUrl,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    });

  req.session.user = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };

  res.status(201).json({ user, tenant });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, user.tenantId))
    .limit(1);

  req.session.user = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };

  res.json({
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    tenant,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const sessionUser = req.session.user!;

  const [user] = await db
    .select({
      id: usersTable.id,
      tenantId: usersTable.tenantId,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
      avatarUrl: usersTable.avatarUrl,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, sessionUser.id))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, user.tenantId))
    .limit(1);

  res.json({ user, tenant });
});

export default router;
