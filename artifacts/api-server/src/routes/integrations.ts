import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, integrationCredentialsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { audit } from "../lib/audit.js";
import { fetchKeywordsFromProvider, type AdapterProvider } from "../lib/keyword-adapters.js";
import { logger } from "../lib/logger.js";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
  normalizeIntegrationCredentials,
} from "../lib/integration-credentials.js";

const router = Router();

const VALID_PROVIDERS = ["ahrefs", "semrush", "dataforseo", "google_search_console"];

router.get("/integrations", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const creds = await db
    .select({
      id: integrationCredentialsTable.id,
      provider: integrationCredentialsTable.provider,
      isActive: integrationCredentialsTable.isActive,
      createdAt: integrationCredentialsTable.createdAt,
      updatedAt: integrationCredentialsTable.updatedAt,
    })
    .from(integrationCredentialsTable)
    .where(eq(integrationCredentialsTable.tenantId, tenantId));
  res.json(creds);
});

router.post(
  "/integrations",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const { provider, credentials } = req.body as {
      provider?: string;
      credentials?: Record<string, string>;
    };

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` });
      return;
    }

    const normalizedCredentials = normalizeIntegrationCredentials(credentials);
    if (!normalizedCredentials) {
      res.status(400).json({ error: "credentials object is required" });
      return;
    }

    const encryptedCredentials = encryptIntegrationCredentials(normalizedCredentials);

    const [existing] = await db
      .select({ id: integrationCredentialsTable.id })
      .from(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.tenantId, tenantId),
          eq(integrationCredentialsTable.provider, provider),
        ),
      )
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(integrationCredentialsTable)
        .set({ credentials: encryptedCredentials, isActive: "true" })
        .where(eq(integrationCredentialsTable.id, existing.id))
        .returning({
          id: integrationCredentialsTable.id,
          provider: integrationCredentialsTable.provider,
          isActive: integrationCredentialsTable.isActive,
        });
    } else {
      [result] = await db
        .insert(integrationCredentialsTable)
        .values({ tenantId, provider, credentials: encryptedCredentials })
        .returning({
          id: integrationCredentialsTable.id,
          provider: integrationCredentialsTable.provider,
          isActive: integrationCredentialsTable.isActive,
        });
    }

    await audit({
      tenantId,
      userId,
      action: "integration.configured",
      resourceType: "integration",
      metadata: { provider },
      req,
    });

    res.status(existing ? 200 : 201).json(result);
  },
);

router.delete(
  "/integrations/:provider",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const provider = req.params.provider as string;

    await db
      .delete(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.tenantId, tenantId),
          eq(integrationCredentialsTable.provider, provider),
        ),
      );

    await audit({
      tenantId,
      userId,
      action: "integration.removed",
      resourceType: "integration",
      metadata: { provider },
      req,
    });
    res.status(204).send();
  },
);

router.post("/integrations/:provider/search", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const provider = req.params.provider as string;
  const { query } = req.body as { query?: string };

  if (!query || query.trim().length === 0) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  if (!["ahrefs", "semrush", "dataforseo"].includes(provider)) {
    res.status(400).json({ error: "Provider not supported for keyword search" });
    return;
  }

  const [cred] = await db
    .select({ credentials: integrationCredentialsTable.credentials })
    .from(integrationCredentialsTable)
    .where(
      and(
        eq(integrationCredentialsTable.tenantId, tenantId),
        eq(integrationCredentialsTable.provider, provider),
      ),
    )
    .limit(1);

  let credentials: Record<string, string>;
  try {
    credentials = decryptIntegrationCredentials(cred?.credentials);
  } catch (err) {
    logger.error(
      { err, tenantId, provider },
      "Failed to decrypt integration credentials for keyword search",
    );
    res.status(500).json({
      error: "Stored integration credentials could not be read. Reconfigure this integration.",
    });
    return;
  }

  const keywords = await fetchKeywordsFromProvider(
    provider as AdapterProvider,
    query.trim(),
    credentials,
  );

  res.json(keywords);
});

export default router;
