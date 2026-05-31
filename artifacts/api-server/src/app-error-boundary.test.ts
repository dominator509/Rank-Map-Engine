import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("api parser error boundary", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const originalEnv = { ...process.env };

  beforeAll(
    async () => {
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL =
        process.env.DATABASE_URL ?? "postgres://invalid:invalid@127.0.0.1:1/invalid";
      process.env.SESSION_SECRET = "parser-error-boundary-secret-at-least-32-characters";

      const { default: app } = await import("./app");
      server = await new Promise<Server>((resolve, reject) => {
        const listener = app.listen(0, () => resolve(listener));
        listener.on("error", reject);
      });

      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server has no TCP port.");
      baseUrl = `http://127.0.0.1:${address.port}`;
    },
    30000,
  );

  afterAll(async () => {
    process.env = originalEnv;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("returns a sanitized JSON response for malformed JSON bodies", async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad-json",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Invalid JSON payload" });
  });
});
