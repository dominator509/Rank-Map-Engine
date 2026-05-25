import { type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const describeBoundaryE2e = process.env.RUN_API_E2E === "1" ? describe : describe.skip;

interface ApiResponse<T = unknown> {
  status: number;
  body: T | null;
}

class ApiAgent {
  private cookie = "";

  constructor(private readonly baseUrl: string) {}

  get<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: "POST", body });
  }

  private async request<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<ApiResponse<T>> {
    const headers = new Headers();
    headers.set("accept", "application/json");
    if (options.body !== undefined) headers.set("content-type", "application/json");
    if (this.cookie) headers.set("cookie", this.cookie);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] ?? "";

    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as T) : null;
    return { status: response.status, body: parsed };
  }
}

describeBoundaryE2e("API boundary validation", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

    const { ensureSessionTable } = await import("../lib/session-table");
    await ensureSessionTable();

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
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    const { pool } = await import("@workspace/db");
    await pool.end();
  });

  it("rejects malformed payloads and degrades gracefully on provider failures", async () => {
    const stamp = Date.now();
    const agent = new ApiAgent(baseUrl);

    const register = await agent.post("/api/auth/register", {
      email: `boundary-${stamp}@example.com`,
      password: "CorrectHorseBatteryStaple!42",
      fullName: "Boundary User",
      tenantName: `Boundary Tenant ${stamp}`,
    });
    expect(register.status).toBe(201);

    const badIntegrationPayload = await agent.post("/api/integrations", {
      provider: "semrush",
      credentials: { apiKey: 12345 },
    });
    expect(badIntegrationPayload.status).toBe(400);

    const goodIntegrationPayload = await agent.post("/api/integrations", {
      provider: "semrush",
      credentials: { apiKey: "semrush-demo-key" },
    });
    expect(goodIntegrationPayload.status).toBe(201);

    const missingQuery = await agent.post("/api/integrations/semrush/search", {});
    expect(missingQuery.status).toBe(400);

    const unsupportedProvider = await agent.post("/api/integrations/google_search_console/search", {
      query: "seo audit",
    });
    expect(unsupportedProvider.status).toBe(400);

    process.env.ALLOW_SEMRUSH_QUERY_AUTH = "true";
    const nativeFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.startsWith(baseUrl)) {
          return nativeFetch(input, init);
        }
        throw new Error("forced upstream failure");
      }),
    );
    const degradedSearch = await agent.post("/api/integrations/semrush/search", {
      query: "seo automation",
    });
    expect(degradedSearch.status).toBe(200);
    expect(Array.isArray(degradedSearch.body)).toBe(true);
    expect((degradedSearch.body as unknown[]).length).toBeGreaterThan(0);
    vi.restoreAllMocks();

    const badKeywordImport = await agent.post("/api/projects/99999/keywords/import", {
      source: "manual",
      keywords: "not-an-array",
    });
    expect([400, 404]).toContain(badKeywordImport.status);
  }, 30000);
});
