import { db, webhookEndpointsTable, webhookDeliveriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";
import crypto from "node:crypto";

export const WEBHOOK_EVENTS = [
  "keyword.imported",
  "cluster.created",
  "cluster.approved",
  "cluster.rejected",
  "brief.created",
  "brief.approved",
  "report.generated",
  "project.created",
  "ai_task.completed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

interface WebhookPayload {
  event: WebhookEvent;
  tenantId: number;
  data: Record<string, unknown>;
  timestamp: string;
}

function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function emitWebhookEvent(
  tenantId: number,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const endpoints = await db
    .select()
    .from(webhookEndpointsTable)
    .where(
      and(eq(webhookEndpointsTable.tenantId, tenantId), eq(webhookEndpointsTable.isActive, true)),
    );

  const active = endpoints.filter((ep) => {
    const events = ep.events as string[];
    return events.length === 0 || events.includes(event);
  });

  if (active.length === 0) return;

  const payload: WebhookPayload = {
    event,
    tenantId,
    data,
    timestamp: new Date().toISOString(),
  };

  for (const ep of active) {
    const body = JSON.stringify(payload);
    const sig = signPayload(ep.secret, body);

    const [delivery] = await db
      .insert(webhookDeliveriesTable)
      .values({
        endpointId: ep.id,
        tenantId,
        event,
        payload,
        status: "pending",
        attempts: 0,
      })
      .returning();

    try {
      const resp = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RankMap-Signature": sig,
          "X-RankMap-Event": event,
          "X-RankMap-Delivery": String(delivery.id),
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      await db
        .update(webhookDeliveriesTable)
        .set({
          status: resp.ok ? "success" : "failed",
          statusCode: resp.status,
          responseBody: (await resp.text()).slice(0, 1000),
          attempts: 1,
          lastAttemptAt: new Date(),
        })
        .where(eq(webhookDeliveriesTable.id, delivery.id));
    } catch (err) {
      logger.warn({ err, deliveryId: delivery.id }, "Webhook delivery failed");
      await db
        .update(webhookDeliveriesTable)
        .set({
          status: "failed",
          attempts: 1,
          lastAttemptAt: new Date(),
          responseBody: err instanceof Error ? err.message : "Unknown error",
        })
        .where(eq(webhookDeliveriesTable.id, delivery.id));
    }
  }
}
