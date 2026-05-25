import { type Server } from "node:http";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const describeConcurrencyE2e = process.env.RUN_API_E2E === "1" ? describe : describe.skip;

interface ApiResponse<T = unknown> {
  status: number;
  body: T | null;
}

class ApiAgent {
  private cookie = "";

  constructor(
    private readonly baseUrl: string,
    private readonly authorization?: string,
  ) {}

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
    if (this.authorization) headers.set("authorization", this.authorization);

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

function expectRecord(body: unknown): Record<string, unknown> {
  expect(body).toBeTruthy();
  expect(typeof body).toBe("object");
  expect(Array.isArray(body)).toBe(false);
  return body as Record<string, unknown>;
}

describeConcurrencyE2e("API concurrency validation", () => {
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
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    const { pool } = await import("@workspace/db");
    await pool.end();
  });

  it("preserves data integrity under parallel authenticated reads and writes", async () => {
    const stamp = Date.now();
    const owner = new ApiAgent(baseUrl);
    const register = await owner.post("/api/auth/register", {
      email: `load-${stamp}@example.com`,
      password: "CorrectHorseBatteryStaple!42",
      fullName: "Load Tester",
      tenantName: `Load Tenant ${stamp}`,
    });
    expect(register.status).toBe(201);

    const client = await owner.post("/api/clients", {
      name: "Load Client",
      domain: "load.example",
      industry: "SaaS",
    });
    expect(client.status).toBe(201);
    const clientId = expectRecord(client.body).id as number;

    const apiKeyResponse = await owner.post("/api/api-keys", { name: "Load API Key" });
    expect(apiKeyResponse.status).toBe(201);
    const apiKeyRecord = expectRecord(apiKeyResponse.body);
    const apiKeyId = apiKeyRecord.id as number;
    const rawApiKey = apiKeyRecord.key as string;
    const apiClient = new ApiAgent(baseUrl, `Bearer ${rawApiKey}`);

    const concurrentReads = await Promise.all(
      Array.from({ length: 25 }).map(() => apiClient.get("/api/tenant/dashboard")),
    );
    expect(concurrentReads.every((res) => res.status === 200)).toBe(true);

    const createCount = 15;
    const writeResults = await Promise.all(
      Array.from({ length: createCount }).map((_, idx) =>
        owner.post("/api/projects", {
          clientId,
          name: `Parallel Project ${idx}`,
          targetDomain: `parallel-${idx}.example`,
          locale: "en-US",
        }),
      ),
    );
    expect(writeResults.every((res) => res.status === 201)).toBe(true);

    const { apiKeysTable, db, projectsTable, tenantsTable } = await import("@workspace/db");
    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.name, `Load Tenant ${stamp}`))
      .limit(1);
    expect(tenant).toBeTruthy();

    const [apiKeyUsage] = await db
      .select({ lastUsedAt: apiKeysTable.lastUsedAt })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.id, apiKeyId))
      .limit(1);
    expect(apiKeyUsage?.lastUsedAt).toBeTruthy();

    const createdProjects = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.tenantId, tenant.id),
          eq(projectsTable.clientId, clientId),
        ),
      );
    expect(createdProjects.length).toBe(createCount);
  }, 30000);
});
