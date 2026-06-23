import { type Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "rate-limit-session-secret-with-at-least-32-characters";
process.env.LOG_LEVEL = "silent";

vi.mock("@workspace/db", () => ({
  pool: {},
}));

vi.mock("connect-pg-simple", () => ({
  default: () =>
    class TestSessionStore {
      on(): this {
        return this;
      }
      get(_sid: string, callback: (err?: unknown, session?: unknown) => void): void {
        callback(undefined, undefined);
      }
      set(_sid: string, _session: unknown, callback?: (err?: unknown) => void): void {
        callback?.();
      }
      destroy(_sid: string, callback?: (err?: unknown) => void): void {
        callback?.();
      }
      touch(_sid: string, _session: unknown, callback?: (err?: unknown) => void): void {
        callback?.();
      }
    },
}));

vi.mock("./routes/index.js", () => {
  const router = express.Router();
  router.use((_req, res) => {
    res.status(401).json({ error: "mock route reached" });
  });
  return { default: router };
});

vi.mock("./routes/billing.js", () => ({
  stripeWebhookHandler: (_req: express.Request, res: express.Response) => {
    res.status(400).json({ error: "mock billing webhook reached" });
  },
}));

async function request(baseUrl: string, path: string, method = "GET"): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({}),
  });
}

describe("route-family rate limits", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const { default: app } = await import("./app.js");
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
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("throttles API key management before the route handler", async () => {
    let response: Response | undefined;
    for (let i = 0; i < 61; i += 1) {
      response = await request(baseUrl, "/api/api-keys", "POST");
    }

    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({
      error: "Too many API key management requests, please try again later.",
    });
  });

  it("throttles provider search workflows before the route handler", async () => {
    let response: Response | undefined;
    for (let i = 0; i < 81; i += 1) {
      response = await request(baseUrl, "/api/integrations/semrush/search", "POST");
    }

    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({
      error: "Too many provider search requests, please try again later.",
    });
  });

  it("throttles billing webhook verification before signature parsing", async () => {
    let response: Response | undefined;
    for (let i = 0; i < 121; i += 1) {
      response = await request(baseUrl, "/api/billing/webhook", "POST");
    }

    expect(response?.status).toBe(429);
    expect(await response?.json()).toEqual({
      error: "Too many billing webhook attempts, please try again later.",
    });
  });
});
