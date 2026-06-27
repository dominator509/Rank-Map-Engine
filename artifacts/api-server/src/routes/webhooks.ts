import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, webhookEndpointsTable, webhookDeliveriesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { audit } from "../lib/audit.js";
import { WEBHOOK_EVENTS, emitWebhookEvent } from "../lib/webhook-emitter.js";
import crypto from "node:crypto";

const router = Router();

function parsePositiveRouteInt(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      [
        "hooks.slack.com",
        "discord.com",
        "discordapp.com",
        "api.notion.com",
        "hook.integromat.com",
        "hooks.zapier.com",
      ].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function parseWebhookEvents(events: unknown): { events: string[]; invalidEvents: string[] } | null {
  if (!Array.isArray(events) || events.some((event) => typeof event !== "string")) {
    return null;
  }
  return {
    events,
    invalidEvents: events.filter((event) => !WEBHOOK_EVENTS.includes(event as never)),
  };
}

function parseDeliveryLimit(value: unknown): number | null {
  const raw = value === undefined ? "20" : String(value);
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) return null;
  return parsed;
}

router.get("/webhooks", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const endpoints = await db
    .select()
    .from(webhookEndpointsTable)
    .where(eq(webhookEndpointsTable.tenantId, tenantId));
  res.json(endpoints.map((ep) => ({ ...ep, secret: undefined })));
});

router.post(
  "/webhooks",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const {
      url,
      events = [],
      description,
    } = req.body as {
      url?: string;
      events?: unknown;
      description?: string;
    };

    if (!url || !isAllowedWebhookUrl(url)) {
      res.status(400).json({ error: "Valid URL is required" });
      return;
    }

    const parsedEvents = parseWebhookEvents(events);
    if (!parsedEvents) {
      res.status(400).json({ error: "events must be an array of strings" });
      return;
    }
    if (parsedEvents.invalidEvents.length > 0) {
      res.status(400).json({ error: `Invalid events: ${parsedEvents.invalidEvents.join(", ")}` });
      return;
    }

    const secret = crypto.randomBytes(24).toString("hex");

    const [endpoint] = await db
      .insert(webhookEndpointsTable)
      .values({ tenantId, url, events: parsedEvents.events, secret, description })
      .returning();

    await audit({
      tenantId,
      userId,
      action: "webhook.created",
      resourceType: "webhook",
      resourceId: endpoint.id,
      metadata: { url },
      req,
    });

    res.status(201).json({ ...endpoint });
  },
);

router.patch(
  "/webhooks/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parsePositiveRouteInt(req.params.id);
    const { url, events, isActive, description } = req.body as {
      url?: string;
      events?: unknown;
      isActive?: boolean;
      description?: string;
    };
    if (id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [ep] = await db
      .select({ id: webhookEndpointsTable.id })
      .from(webhookEndpointsTable)
      .where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.tenantId, tenantId)))
      .limit(1);

    if (!ep) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (url !== undefined) {
      if (!isAllowedWebhookUrl(url)) {
        res.status(400).json({ error: "Valid URL is required" });
        return;
      }
      updates.url = url;
    }
    if (events !== undefined) {
      const parsedEvents = parseWebhookEvents(events);
      if (!parsedEvents) {
        res.status(400).json({ error: "events must be an array of strings" });
        return;
      }
      if (parsedEvents.invalidEvents.length > 0) {
        res.status(400).json({ error: `Invalid events: ${parsedEvents.invalidEvents.join(", ")}` });
        return;
      }
      updates.events = parsedEvents.events;
    }
    if (isActive !== undefined) updates.isActive = isActive;
    if (description !== undefined) updates.description = description;

    const [updated] = await db
      .update(webhookEndpointsTable)
      .set(updates)
      .where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.tenantId, tenantId)))
      .returning();

    res.json({ ...updated, secret: undefined });
  },
);

router.delete(
  "/webhooks/:id",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId, id: userId } = req.session.user!;
    const id = parsePositiveRouteInt(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    await db
      .delete(webhookEndpointsTable)
      .where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.tenantId, tenantId)));

    await audit({
      tenantId,
      userId,
      action: "webhook.deleted",
      resourceType: "webhook",
      resourceId: id,
      req,
    });
    res.status(204).send();
  },
);

router.post(
  "/webhooks/:id/test",
  requireAuth,
  requireRole(["agency_admin", "super_admin"]),
  async (req, res): Promise<void> => {
    const { tenantId } = req.session.user!;
    const id = parsePositiveRouteInt(req.params.id);
    if (id == null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [ep] = await db
      .select({ id: webhookEndpointsTable.id })
      .from(webhookEndpointsTable)
      .where(and(eq(webhookEndpointsTable.id, id), eq(webhookEndpointsTable.tenantId, tenantId)))
      .limit(1);

    if (!ep) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }

    await emitWebhookEvent(tenantId, "project.created", { test: true, endpointId: id });
    res.json({ message: "Test event sent" });
  },
);

router.get("/webhooks/:id/deliveries", requireAuth, async (req, res): Promise<void> => {
  const { tenantId } = req.session.user!;
  const id = parsePositiveRouteInt(req.params.id);
  const limit = parseDeliveryLimit(req.query.limit);
  if (id == null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (limit == null) {
    res.status(400).json({ error: "Invalid limit" });
    return;
  }

  const deliveries = await db
    .select()
    .from(webhookDeliveriesTable)
    .where(
      and(eq(webhookDeliveriesTable.endpointId, id), eq(webhookDeliveriesTable.tenantId, tenantId)),
    )
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(limit);

  res.json(deliveries);
});

router.get("/webhooks/events", requireAuth, async (req, res): Promise<void> => {
  res.json(WEBHOOK_EVENTS);
});

export default router;
