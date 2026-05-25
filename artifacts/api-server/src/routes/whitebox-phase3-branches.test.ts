import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

function stripeSignature(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("whitebox phase 3 - route branch coverage", () => {
  let server: Server;
  let baseUrl = "";
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "whitebox-session-secret-with-at-least-32-characters";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_whitebox";
    process.env.HEALTH_CHECK_TOKEN = "health-token";
    delete process.env.FEATURE_BILLING;
    delete process.env.FEATURE_STRIPE_BILLING;

    const { default: app } = await import("../app");
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(0, () => resolve(listener));
      listener.on("error", reject);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not expose a TCP port.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    process.env = originalEnv;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("returns ok detailed health when token matches and dependencies are healthy", async () => {
    delete process.env.FEATURE_BILLING;
    delete process.env.FEATURE_STRIPE_BILLING;
    process.env.DATABASE_URL = "postgres://invalid:invalid@127.0.0.1:1/invalid";
    const dbExecuteMock = vi
      .spyOn((await import("@workspace/db")).db, "execute")
      .mockResolvedValueOnce({} as never);

    const response = await fetch(`${baseUrl}/api/healthz/detailed`, {
      headers: { "x-health-check-token": "health-token" },
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    const services = body.services as Record<string, unknown>;
    expect((services.database as Record<string, unknown>).status).toBe("ok");
    expect((services.billing as Record<string, unknown>).status).toBe("disabled");
    expect(dbExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("returns degraded health when billing is enabled but required env is missing", async () => {
    process.env.FEATURE_BILLING = "true";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_SOLO;
    delete process.env.STRIPE_PRICE_AGENCY;
    delete process.env.STRIPE_PRICE_ENTERPRISE;

    const dbExecuteMock = vi
      .spyOn((await import("@workspace/db")).db, "execute")
      .mockResolvedValueOnce({} as never);

    const response = await fetch(`${baseUrl}/api/healthz/detailed`, {
      headers: { authorization: "Bearer health-token" },
    });
    const body = (await response.json()) as Record<string, unknown>;
    const services = body.services as Record<string, unknown>;
    const billing = services.billing as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(billing.status).toBe("missing-config");
    expect(Array.isArray(billing.missing)).toBe(true);
    expect((billing.missing as unknown[]).length).toBeGreaterThan(0);
    expect(dbExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("returns degraded health when database ping throws", async () => {
    delete process.env.FEATURE_BILLING;
    delete process.env.FEATURE_STRIPE_BILLING;
    const dbExecuteMock = vi
      .spyOn((await import("@workspace/db")).db, "execute")
      .mockRejectedValueOnce(new Error("db down"));

    const response = await fetch(`${baseUrl}/api/healthz/detailed`, {
      headers: { "x-health-check-token": "health-token" },
    });
    const body = (await response.json()) as Record<string, unknown>;
    const services = body.services as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect((services.database as Record<string, unknown>).status).toBe("error");
    expect(dbExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("rejects webhook when stripe signature header is malformed", async () => {
    const payload = JSON.stringify({ id: "evt_1", type: "customer.created", data: { object: {} } });
    const response = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "bad-header" },
      body: payload,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Stripe webhook." });
  });

  it("rejects webhook when timestamp is outside tolerance", async () => {
    const payload = JSON.stringify({ id: "evt_2", type: "customer.created", data: { object: {} } });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 10 * 60;
    const signature = stripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!, staleTimestamp);

    const response = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: payload,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Stripe webhook." });
  });

  it("accepts webhook with valid signature and ignored event type", async () => {
    const payload = JSON.stringify({
      id: "evt_3",
      type: "customer.created",
      data: { object: {} },
    });
    const now = Math.floor(Date.now() / 1000);
    const signature = stripeSignature(payload, process.env.STRIPE_WEBHOOK_SECRET!, now);

    const response = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: payload,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });
});
