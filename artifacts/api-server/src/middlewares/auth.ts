import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { apiKeysTable, db, usersTable } from "@workspace/db";

type AuthenticatedUser = NonNullable<Request["session"]["user"]>;

function setRequestScopedSessionUser(req: Request, user: AuthenticatedUser): void {
  Object.defineProperty(req.session, "user", {
    value: user,
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

async function authenticateApiKey(req: Request): Promise<boolean> {
  const authorization = req.get("authorization");
  const [scheme, rawKey] = authorization?.split(/\s+/, 2) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !rawKey?.startsWith("rm_")) {
    return false;
  }

  const keyPrefix = rawKey.slice(0, 10);
  const candidates = await db
    .select({
      apiKeyId: apiKeysTable.id,
      keyHash: apiKeysTable.keyHash,
      expiresAt: apiKeysTable.expiresAt,
      userId: usersTable.id,
      tenantId: usersTable.tenantId,
      email: usersTable.email,
      fullName: usersTable.fullName,
      role: usersTable.role,
    })
    .from(apiKeysTable)
    .innerJoin(usersTable, eq(apiKeysTable.userId, usersTable.id))
    .where(and(eq(apiKeysTable.keyPrefix, keyPrefix), isNull(apiKeysTable.revokedAt)));

  for (const candidate of candidates) {
    const keyMatches = await bcrypt.compare(rawKey, candidate.keyHash);
    if (!keyMatches) continue;

    if (candidate.expiresAt && candidate.expiresAt <= new Date()) {
      return false;
    }

    setRequestScopedSessionUser(req, {
      id: candidate.userId,
      tenantId: candidate.tenantId,
      email: candidate.email,
      fullName: candidate.fullName,
      role: candidate.role,
    });

    await db
      .update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, candidate.apiKeyId));

    return true;
  }

  return false;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.user) {
    const authenticated = await authenticateApiKey(req);
    if (!authenticated) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  next();
}

export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session.user) {
      const authenticated = await authenticateApiKey(req);
      if (!authenticated) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    const user = req.session.user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
