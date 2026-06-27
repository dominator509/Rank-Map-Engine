import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, apiKeysTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { audit } from "../lib/audit.js";
import { normalizeApiKeyScopes } from "../lib/api-key-scopes.js";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const router = Router();

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

router.get("/api-keys", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const keys = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      scopes: apiKeysTable.scopes,
      lastUsedAt: apiKeysTable.lastUsedAt,
      expiresAt: apiKeysTable.expiresAt,
      revokedAt: apiKeysTable.revokedAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.tenantId, tenantId), isNull(apiKeysTable.revokedAt)));
  res.json(keys);
});

router.post("/api-keys", requireAuth, async (req, res): Promise<void> => {
  const { tenantId, id: userId } = req.session.user!;
  const { name, scopes, expiresInDays } = req.body as {
    name?: string;
    scopes?: string[];
    expiresInDays?: number;
  };

  if (!name || name.trim().length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const normalizedScopes = normalizeApiKeyScopes(scopes, { defaultWhenUndefined: true });
  if (!normalizedScopes) {
    res.status(400).json({ error: "scopes must include read, write, or both" });
    return;
  }

  const rawKey = `rm_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = rawKey.slice(0, 10);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [apiKey] = await db
    .insert(apiKeysTable)
    .values({
      tenantId,
      userId,
      name: name.trim(),
      keyHash,
      keyPrefix,
      scopes: normalizedScopes,
      expiresAt: expiresAt ?? undefined,
    })
    .returning({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      scopes: apiKeysTable.scopes,
      expiresAt: apiKeysTable.expiresAt,
      createdAt: apiKeysTable.createdAt,
    });

  await audit({
    tenantId,
    userId,
    action: "api_key.created",
    resourceType: "api_key",
    resourceId: apiKey.id,
    metadata: { name },
    req,
  });

  res.status(201).json({ ...apiKey, key: rawKey });
});

router.delete("/api-keys/:id", requireAuth, async (req, res): Promise<void> => {
  const { tenantId, id: userId } = req.session.user!;
  const id = parsePositiveRouteInt(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [key] = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.tenantId, tenantId)))
    .limit(1);

  if (!key) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.tenantId, tenantId)));

  await audit({
    tenantId,
    userId,
    action: "api_key.revoked",
    resourceType: "api_key",
    resourceId: id,
    req,
  });

  res.status(204).send();
});

export default router;
