import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
  normalizeIntegrationCredentials,
} from "./integration-credentials";

function stripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe.sequential("whitebox phase 4 - security and exception boundaries", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://invalid@127.0.0.1:1/invalid";
    process.env.SESSION_SECRET = "whitebox-session-secret-with-at-least-32-characters";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_whitebox_phase4";

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
  }, 30000);

  afterAll(async () => {
    process.env = originalEnv;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("rejects tainted credential records with non-string values", () => {
    expect(normalizeIntegrationCredentials({ apiKey: "ok", nested: { bad: true } })).toBeNull();
    expect(normalizeIntegrationCredentials(["nope"])).toBeNull();
    expect(normalizeIntegrationCredentials(null)).toBeNull();
  });

  it("fails closed when decrypted payload is not a valid string map", () => {
    const encrypted = encryptIntegrationCredentials({ token: "abc123" });
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from('{"token":1}', "utf8").toString("base64"),
    };
    expect(() => decryptIntegrationCredentials(tampered)).toThrow();

    expect(decryptIntegrationCredentials({ token: 1 })).toEqual({});
  });

  it("returns generic 400 webhook error for missing signature", async () => {
    const response = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "evt_missing_sig",
        type: "customer.created",
        data: { object: {} },
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Stripe webhook." });
  });

  it("returns generic 400 webhook error for invalid JSON payload with valid signature", async () => {
    const malformedPayload = '{"id":"evt_bad_json","type":"customer.created","data":';
    const signature = stripeSignature(malformedPayload, process.env.STRIPE_WEBHOOK_SECRET!);

    const response = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: malformedPayload,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid Stripe webhook." });
  });
});
