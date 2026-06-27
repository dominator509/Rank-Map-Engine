import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const describeApiE2e = process.env.RUN_API_E2E === "1" ? describe : describe.skip;

interface ApiResponse<T = unknown> {
  status: number;
  body: T | null;
}

class ApiAgent {
  private cookie = "";
  private readonly authorization?: string;

  constructor(
    private readonly baseUrl: string,
    options: { authorization?: string } = {},
  ) {
    this.authorization = options.authorization;
  }

  get<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: "POST", body });
  }

  async postText(
    path: string,
    body?: unknown,
  ): Promise<{ status: number; text: string; headers: Headers }> {
    const headers = new Headers();
    headers.set("accept", "*/*");
    if (body !== undefined) headers.set("content-type", "application/json");
    if (this.cookie) headers.set("cookie", this.cookie);
    if (this.authorization) headers.set("authorization", this.authorization);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    this.storeCookies(response.headers);
    return { status: response.status, text: await response.text(), headers: response.headers };
  }

  postRaw<T = unknown>(
    path: string,
    body: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: "POST",
      body,
      rawBody: true,
      extraHeaders,
    });
  }

  patch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  put<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: "PUT", body });
  }

  delete<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: "DELETE" });
  }

  private async request<T = unknown>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      rawBody?: boolean;
      extraHeaders?: Record<string, string>;
    } = {},
  ): Promise<ApiResponse<T>> {
    const headers = new Headers();
    headers.set("accept", "application/json");
    if (options.body !== undefined) headers.set("content-type", "application/json");
    for (const [key, value] of Object.entries(options.extraHeaders ?? {})) {
      headers.set(key, value);
    }
    if (this.cookie) headers.set("cookie", this.cookie);
    if (this.authorization) headers.set("authorization", this.authorization);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined
          ? undefined
          : options.rawBody
            ? (options.body as string)
            : JSON.stringify(options.body),
    });

    this.storeCookies(response.headers);

    const text = await response.text();
    const body = text ? (JSON.parse(text) as T) : null;
    return { status: response.status, body };
  }

  private storeCookies(headers: Headers): void {
    const headersWithSetCookie = headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headersWithSetCookie.getSetCookie?.() ?? [];
    const fallback = headers.get("set-cookie");
    const cookieHeaders = setCookies.length > 0 ? setCookies : fallback ? [fallback] : [];

    if (cookieHeaders.length === 0) return;

    this.cookie = cookieHeaders
      .map((cookieHeader) => cookieHeader.split(";")[0])
      .filter(Boolean)
      .join("; ");
  }
}

function expectRecord(body: unknown): Record<string, unknown> {
  expect(body).toBeTruthy();
  expect(typeof body).toBe("object");
  expect(Array.isArray(body)).toBe(false);
  return body as Record<string, unknown>;
}

function expectArray(body: unknown): Record<string, unknown>[] {
  expect(Array.isArray(body)).toBe(true);
  return body as Record<string, unknown>[];
}

function idFrom(record: Record<string, unknown>, key = "id"): number {
  const value = record[key];
  expect(typeof value).toBe("number");
  return value as number;
}

function stripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(payload)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describeApiE2e("API end-to-end workflows", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_webhook_secret";
    delete process.env.OPENAI_API_KEY;
    delete process.env.FEATURE_BILLING;
    delete process.env.FEATURE_STRIPE_BILLING;

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

  it("covers core workspace workflows, repaired route aliases, API keys, and tenant isolation", async () => {
    const unauthenticated = new ApiAgent(baseUrl);
    expect((await unauthenticated.get("/api/clients")).status).toBe(401);

    const stamp = Date.now();
    const tenantA = new ApiAgent(baseUrl);
    const registered = await tenantA.post("/api/auth/register", {
      email: `tenant-a-${stamp}@example.com`,
      password: "CorrectHorseBatteryStaple!42",
      fullName: "Tenant A Admin",
      tenantName: `Tenant A ${stamp}`,
    });
    expect(registered.status).toBe(201);

    const authMe = await tenantA.get("/api/auth/me");
    expect(authMe.status).toBe(200);
    const tenantAUserId = idFrom(expectRecord(expectRecord(authMe.body).user));

    expect((await unauthenticated.get("/api/healthz")).status).toBe(200);
    expect((await unauthenticated.get("/api/healthz/detailed")).status).toBe(401);
    expect((await tenantA.get("/api/healthz/detailed")).status).toBe(403);

    const tenantAlias = await tenantA.get("/api/tenants/me");
    expect(tenantAlias.status).toBe(200);
    const tenantRecord = expectRecord(tenantAlias.body);
    const tenantId = idFrom(tenantRecord);
    expect(tenantRecord.name).toBe(`Tenant A ${stamp}`);

    const client = expectRecord(
      (
        await tenantA.post("/api/clients", {
          name: "E2E Client",
          domain: "e2e.example",
          industry: "SaaS",
        })
      ).body,
    );
    const clientId = idFrom(client);

    expect((await tenantA.get("/api/projects?clientId=bogus")).status).toBe(400);
    expect((await tenantA.get("/api/projects?clientId=0")).status).toBe(400);
    expect((await tenantA.get("/api/projects?clientId=1e2")).status).toBe(400);

    const integrationCredentials = { apiKey: `semrush-secret-${stamp}` };
    const integration = await tenantA.post("/api/integrations", {
      provider: "semrush",
      credentials: integrationCredentials,
    });
    expect(integration.status).toBe(201);
    expect(expectRecord(integration.body).credentials).toBeUndefined();

    const { apiKeysTable, db, integrationCredentialsTable } = await import("@workspace/db");
    const { and, eq } = await import("drizzle-orm");
    const { migratePlaintextIntegrationCredentials } =
      await import("../lib/integration-credential-migration");
    const { decryptIntegrationCredentials, isEncryptedIntegrationCredentials } =
      await import("../lib/integration-credentials");
    const [storedIntegration] = await db
      .select({ credentials: integrationCredentialsTable.credentials })
      .from(integrationCredentialsTable)
      .where(
        and(
          eq(integrationCredentialsTable.tenantId, tenantId),
          eq(integrationCredentialsTable.provider, "semrush"),
        ),
      )
      .limit(1);
    expect(storedIntegration).toBeTruthy();
    expect(JSON.stringify(storedIntegration.credentials)).not.toContain(
      integrationCredentials.apiKey,
    );
    expect(isEncryptedIntegrationCredentials(storedIntegration.credentials)).toBe(true);
    expect(decryptIntegrationCredentials(storedIntegration.credentials)).toEqual(
      integrationCredentials,
    );

    const legacyCredentials = { apiKey: `legacy-secret-${stamp}` };
    const [legacyIntegration] = await db
      .insert(integrationCredentialsTable)
      .values({
        tenantId,
        provider: "legacy-provider",
        credentials: legacyCredentials,
      })
      .returning({ id: integrationCredentialsTable.id });
    expect(legacyIntegration).toBeTruthy();

    const migrationResult = await migratePlaintextIntegrationCredentials();
    expect(migrationResult.migrated).toBeGreaterThanOrEqual(1);

    const [migratedLegacyIntegration] = await db
      .select({ credentials: integrationCredentialsTable.credentials })
      .from(integrationCredentialsTable)
      .where(eq(integrationCredentialsTable.id, legacyIntegration.id))
      .limit(1);
    expect(JSON.stringify(migratedLegacyIntegration.credentials)).not.toContain(
      legacyCredentials.apiKey,
    );
    expect(isEncryptedIntegrationCredentials(migratedLegacyIntegration.credentials)).toBe(true);
    expect(decryptIntegrationCredentials(migratedLegacyIntegration.credentials)).toEqual(
      legacyCredentials,
    );

    const project = expectRecord(
      (
        await tenantA.post("/api/projects", {
          clientId,
          name: "E2E Project",
          targetDomain: "e2e.example",
          locale: "en-US",
        })
      ).body,
    );
    const projectId = idFrom(project);

    const dashboardAlias = await tenantA.get("/api/dashboard");
    expect(dashboardAlias.status).toBe(200);
    expect(expectRecord(dashboardAlias.body).clientCount).toBe(1);

    const flatProject = await tenantA.get(`/api/projects/${projectId}`);
    expect(flatProject.status).toBe(200);
    expect(expectRecord(flatProject.body).name).toBe("E2E Project");
    expect((await tenantA.get("/api/projects/1e2")).status).toBe(400);
    expect((await tenantA.patch("/api/projects/1e2", { name: "Bad Project" })).status).toBe(400);
    expect((await tenantA.delete("/api/projects/1e2")).status).toBe(400);
    expect((await tenantA.get("/api/projects/1e2/score-settings")).status).toBe(400);

    const imported = await tenantA.post(`/api/projects/${projectId}/keywords/import`, {
      source: "manual",
      keywords: [
        {
          phrase: "rank map engine",
          searchVolume: 1200,
          cpc: 4.2,
          kd: 33,
          intent: "commercial",
        },
        {
          phrase: "seo topic map",
          searchVolume: 900,
          cpc: 3.1,
          kd: 29,
          intent: "informational",
        },
      ],
    });
    expect(imported.status).toBe(200);

    const keywordsAfterImport = await tenantA.get(`/api/projects/${projectId}/keywords`);
    expect(keywordsAfterImport.status).toBe(200);
    const importedKeywords = expectArray(keywordsAfterImport.body);
    expect(importedKeywords.length).toBeGreaterThanOrEqual(2);
    const firstKeywordId = idFrom(expectRecord(importedKeywords[0]));
    expect((await tenantA.get("/api/projects/not-a-number/keywords")).status).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/keywords/not-a-number`)).status).toBe(
      400,
    );
    expect(
      (
        await tenantA.patch(`/api/projects/${projectId}/keywords/not-a-number`, {
          isActive: true,
        })
      ).status,
    ).toBe(400);
    expect((await tenantA.delete(`/api/projects/${projectId}/keywords/not-a-number`)).status).toBe(
      400,
    );
    expect(
      (await tenantA.get(`/api/projects/${projectId}/keywords/${firstKeywordId}`)).status,
    ).toBe(200);

    expect(
      (
        await tenantA.post(`/api/projects/${projectId}/competitors`, {
          domain: "stable-rival.example",
          label: "Stable Rival",
        })
      ).status,
    ).toBe(201);
    expect((await tenantA.get("/api/projects/not-a-number/competitors")).status).toBe(400);
    expect((await tenantA.get("/api/projects/not-a-number/competitors/keyword-gap")).status).toBe(
      400,
    );
    expect(
      (await tenantA.delete("/api/projects/not-a-number/competitors/not-a-number")).status,
    ).toBe(400);

    const firstGap = await tenantA.get(`/api/projects/${projectId}/competitors/keyword-gap`);
    const secondGap = await tenantA.get(`/api/projects/${projectId}/competitors/keyword-gap`);
    expect(firstGap.status).toBe(200);
    expect(secondGap.status).toBe(200);
    expect(expectRecord(firstGap.body).keywords).toEqual(expectRecord(secondGap.body).keywords);

    expect((await tenantA.post(`/api/projects/${projectId}/rankings/check-all`)).status).toBe(200);
    expect((await tenantA.post(`/api/projects/${projectId}/rankings/check-all`)).status).toBe(200);
    const rankingHistory = await tenantA.get(
      `/api/projects/${projectId}/rankings/${firstKeywordId}/history`,
    );
    expect(rankingHistory.status).toBe(200);
    const rankingRows = expectArray(rankingHistory.body);
    expect(rankingRows.length).toBeGreaterThanOrEqual(2);
    expect(expectRecord(rankingRows[0]).position).toEqual(expectRecord(rankingRows[1]).position);
    expect((await tenantA.get("/api/projects/1e2/rankings")).status).toBe(400);
    expect((await tenantA.get("/api/projects/1e2/rankings/1e2/history")).status).toBe(400);
    expect(
      (await tenantA.post("/api/projects/1e2/rankings/check", { keywordId: firstKeywordId }))
        .status,
    ).toBe(400);
    expect((await tenantA.post("/api/projects/1e2/rankings/check-all")).status).toBe(400);
    expect(
      (await tenantA.get(`/api/projects/${projectId}/rankings/${firstKeywordId}/history`)).status,
    ).toBe(200);

    const clusterAlias = await tenantA.post(`/api/projects/${projectId}/cluster-keywords`);
    expect(clusterAlias.status).toBe(201);
    expect(expectArray(expectRecord(clusterAlias.body).clusters).length).toBeGreaterThan(0);

    const pillar = expectRecord(
      (
        await tenantA.post(`/api/projects/${projectId}/clusters`, {
          label: "SEO Strategy",
          clusterType: "pillar",
        })
      ).body,
    );
    const pillarId = idFrom(pillar);

    expect((await tenantA.get("/api/projects/1e2/clusters")).status).toBe(400);
    expect(
      (await tenantA.post("/api/projects/1e2/clusters", { label: "Bad", clusterType: "pillar" }))
        .status,
    ).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/clusters/1e2`)).status).toBe(400);
    expect(
      (
        await tenantA.patch(`/api/projects/${projectId}/clusters/1e2`, {
          label: "Bad",
        })
      ).status,
    ).toBe(400);
    expect((await tenantA.delete(`/api/projects/${projectId}/clusters/1e2`)).status).toBe(400);
    expect((await tenantA.post(`/api/projects/${projectId}/clusters/1e2/approve`)).status).toBe(
      400,
    );
    expect((await tenantA.post(`/api/projects/${projectId}/clusters/1e2/reject`)).status).toBe(400);
    await tenantA.post(`/api/projects/${projectId}/clusters/${pillarId}/approve`);
    expect((await tenantA.get(`/api/projects/${projectId}/clusters/${pillarId}`)).status).toBe(200);

    const supporting = await tenantA.post(`/api/projects/${projectId}/clusters`, {
      label: "SEO Tools",
      pillarTopic: "SEO Strategy",
      clusterType: "supporting",
    });
    expect(supporting.status).toBe(201);

    const topicMap = await tenantA.get(`/api/projects/${projectId}/topic-map`);
    expect(topicMap.status).toBe(200);
    const topicMapBody = expectRecord(topicMap.body);
    expect(topicMapBody.projectId).toBe(projectId);
    expect(topicMapBody.totalClusters).toBeGreaterThanOrEqual(3);
    const pillars = expectArray(topicMapBody.pillars);
    expect(pillars).toHaveLength(1);
    expect(expectArray(pillars[0].clusters)).toHaveLength(1);
    expect((await tenantA.get("/api/projects/1e2/topic-map")).status).toBe(400);
    expect((await tenantA.get("/api/projects/1e2/roadmap")).status).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/topic-map`)).status).toBe(200);
    expect((await tenantA.get(`/api/projects/${projectId}/roadmap`)).status).toBe(200);

    const brief = expectRecord(
      (
        await tenantA.post(`/api/projects/${projectId}/briefs`, {
          clusterId: pillarId,
          title: "E2E Content Brief",
          targetWordCount: 1500,
        })
      ).body,
    );
    const briefId = idFrom(brief);
    expect((await tenantA.get("/api/projects/1e2/briefs")).status).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/briefs/1e2`)).status).toBe(400);

    const generatedBrief = await tenantA.post(
      `/api/projects/${projectId}/briefs/${briefId}/generate`,
    );
    expect(generatedBrief.status).toBe(200);
    expect(expectRecord(expectRecord(generatedBrief.body).brief).outline).toBeTruthy();
    const aiTaskId = expectRecord(generatedBrief.body).taskId as number;
    expect((await tenantA.get("/api/ai-tasks/not-a-number")).status).toBe(400);
    expect((await tenantA.get(`/api/ai-tasks/${aiTaskId}`)).status).toBe(200);

    const report = await tenantA.post(`/api/projects/${projectId}/reports`, {
      type: "project_summary",
      format: "json",
    });
    expect(report.status).toBe(201);
    const reportId = idFrom(expectRecord(report.body));
    const template = expectRecord(
      (
        await tenantA.post(`/api/projects/${projectId}/save-as-template`, {
          name: "E2E Project Template",
          description: "Snapshot template for hardening coverage",
        })
      ).body,
    );
    const templateId = idFrom(template);
    const templates = await tenantA.get("/api/templates");
    expect(templates.status).toBe(200);
    expect(
      expectArray(templates.body).some((entry) => idFrom(expectRecord(entry)) === templateId),
    ).toBe(true);
    expect(
      (await tenantA.post("/api/projects/not-a-number/save-as-template", { name: "Bad" })).status,
    ).toBe(400);
    expect(
      (await tenantA.patch("/api/templates/not-a-number", { description: "Bad" })).status,
    ).toBe(400);
    expect((await tenantA.delete("/api/templates/not-a-number")).status).toBe(400);
    expect(
      (
        await tenantA.patch(`/api/templates/${templateId}`, {
          description: "Updated template description",
        })
      ).status,
    ).toBe(200);
    expect((await tenantA.delete(`/api/templates/${templateId}`)).status).toBe(204);
    expect((await tenantA.get("/api/projects/1e2/reports")).status).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/reports/1e2`)).status).toBe(400);
    expect((await tenantA.delete("/api/projects/1e2/reports/1e2")).status).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/reports/${reportId}`)).status).toBe(200);
    expect((await tenantA.delete(`/api/projects/${projectId}/reports/${reportId}`)).status).toBe(
      204,
    );
    expect((await tenantA.get("/api/projects/1e2/export/keywords.csv")).status).toBe(400);
    expect((await tenantA.get("/api/projects/1e2/export/project.json")).status).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/export/keywords.csv`)).status).toBe(200);
    expect((await tenantA.get(`/api/projects/${projectId}/export/project.json`)).status).toBe(200);

    expect(
      (await tenantA.get(`/api/projects/${projectId}/calendar?year=2026&month=2`)).status,
    ).toBe(200);
    expect((await tenantA.get("/api/projects/1e2/calendar?year=2026&month=2")).status).toBe(400);
    expect(
      (await tenantA.get(`/api/projects/${projectId}/calendar?year=2026foo&month=2`)).status,
    ).toBe(400);
    expect(
      (await tenantA.get(`/api/projects/${projectId}/calendar?year=2026&month=13`)).status,
    ).toBe(400);
    expect((await tenantA.get(`/api/projects/${projectId}/calendar?year=2026`)).status).toBe(400);
    expect((await tenantA.patch("/api/projects/1e2/calendar/1e2", { title: "Bad" })).status).toBe(
      400,
    );
    expect((await tenantA.delete("/api/projects/1e2/calendar/1e2")).status).toBe(400);

    const customField = expectRecord(
      (
        await tenantA.post("/api/custom-fields", {
          entityType: "project",
          name: "Priority",
          slug: "priority",
          fieldType: "text",
        })
      ).body,
    );
    expect((await tenantA.delete("/api/custom-fields/1e2")).status).toBe(400);

    expect((await tenantA.get("/api/comments?entityType=project&entityId=bogus")).status).toBe(400);
    expect((await tenantA.get("/api/comments?entityType=project&entityId=0")).status).toBe(400);
    expect((await tenantA.get("/api/comments?entityType=project&entityId=1e2")).status).toBe(400);
    expect((await tenantA.patch("/api/comments/1e2/resolve")).status).toBe(400);
    expect((await tenantA.delete("/api/comments/1e2")).status).toBe(400);
    expect(
      (await tenantA.get("/api/custom-field-values?entityType=project&entityId=bogus")).status,
    ).toBe(400);
    expect(
      (await tenantA.get("/api/custom-field-values?entityType=project&entityId=0")).status,
    ).toBe(400);
    expect(
      (await tenantA.get("/api/custom-field-values?entityType=project&entityId=1e2")).status,
    ).toBe(400);

    const reportSchedule = expectRecord(
      (
        await tenantA.post("/api/report-schedules", {
          projectId,
          reportType: "project_summary",
          frequency: "weekly",
          recipientEmails: ["reports@example.com"],
        })
      ).body,
    );
    const projectSchedules = await tenantA.get(`/api/projects/${projectId}/report-schedules`);
    expect(projectSchedules.status).toBe(200);
    expect(
      expectArray(projectSchedules.body).some(
        (entry) => idFrom(expectRecord(entry)) === idFrom(reportSchedule),
      ),
    ).toBe(true);
    expect((await tenantA.get("/api/projects/1e2/report-schedules")).status).toBe(400);
    expect(
      (await tenantA.patch("/api/report-schedules/not-a-number", { frequency: "daily" })).status,
    ).toBe(400);
    expect((await tenantA.delete("/api/report-schedules/not-a-number")).status).toBe(400);

    const webhookEndpoint = expectRecord(
      (
        await tenantA.post("/api/webhooks", {
          url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
          events: ["project.created"],
          description: "E2E webhook",
        })
      ).body,
    );
    const webhookPatch = await tenantA.patch(`/api/webhooks/${idFrom(webhookEndpoint)}`, {
      events: ["brief.created"],
      isActive: false,
    });
    expect(webhookPatch.status).toBe(200);
    expect(expectRecord(webhookPatch.body).secret).toBeUndefined();
    expect(
      (
        await tenantA.patch(`/api/webhooks/${idFrom(webhookEndpoint)}`, {
          events: ["not.real"],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await tenantA.patch(`/api/webhooks/${idFrom(webhookEndpoint)}`, {
          events: "project.created",
        })
      ).status,
    ).toBe(400);
    expect((await tenantA.patch("/api/webhooks/1e2", { isActive: true })).status).toBe(400);
    expect((await tenantA.patch("/api/webhooks/not-a-number", { isActive: true })).status).toBe(
      400,
    );
    expect((await tenantA.delete("/api/webhooks/1e2")).status).toBe(400);
    expect((await tenantA.delete("/api/webhooks/not-a-number")).status).toBe(400);
    expect((await tenantA.post("/api/webhooks/1e2/test")).status).toBe(400);
    expect((await tenantA.post("/api/webhooks/not-a-number/test")).status).toBe(400);
    expect((await tenantA.get("/api/webhooks/1e2/deliveries")).status).toBe(400);
    expect((await tenantA.get("/api/webhooks/not-a-number/deliveries")).status).toBe(400);
    expect(
      (await tenantA.get(`/api/webhooks/${idFrom(webhookEndpoint)}/deliveries?limit=bogus`)).status,
    ).toBe(400);
    expect(
      (await tenantA.get(`/api/webhooks/${idFrom(webhookEndpoint)}/deliveries?limit=0`)).status,
    ).toBe(400);
    expect(
      (await tenantA.get(`/api/webhooks/${idFrom(webhookEndpoint)}/deliveries?limit=101`)).status,
    ).toBe(400);

    const auditLog = await tenantA.get("/api/audit-log?limit=10&offset=0");
    expect(auditLog.status).toBe(200);
    expect((await tenantA.get("/api/audit-log?limit=bogus")).status).toBe(400);
    expect((await tenantA.get("/api/audit-log?limit=0")).status).toBe(400);
    expect((await tenantA.get("/api/audit-log?limit=201")).status).toBe(400);
    expect((await tenantA.get("/api/audit-log?offset=-1")).status).toBe(400);
    expect((await tenantA.get("/api/audit-log?offset=10001")).status).toBe(400);
    expect((await tenantA.get("/api/geo-aeo/client/audits/not-a-number")).status).toBe(400);
    expect((await tenantA.get("/api/geo-aeo/audits?clientId=1e2")).status).toBe(400);
    expect((await tenantA.get("/api/geo-aeo/audits?projectId=bogus")).status).toBe(400);

    const geoAudit = expectRecord(
      (
        await tenantA.post("/api/geo-aeo/audits", {
          clientId,
          projectId,
          auditName: "E2E GEO AEO Audit",
          websiteUrl: "https://e2e.example",
          niche: "SaaS analytics",
          servicesOrProducts: ["rank tracking", "AI visibility"],
          targetLocation: "United States",
          targetAudience: "Marketing teams",
          businessFacts: {},
          targetEngines: ["chatgpt", "perplexity"],
          monitoringEnabled: true,
          monitoringCadence: "monthly",
        })
      ).body,
    );
    const geoAuditId = idFrom(geoAudit);

    const geoPrompt = expectRecord(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/prompts`, {
          promptText: "What is the best AI visibility platform for SaaS teams?",
          intent: "commercial",
          priority: 90,
        })
      ).body,
    );
    const geoPromptId = idFrom(geoPrompt);

    const geoSnapshot = expectRecord(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/snapshots`, {
          promptId: geoPromptId,
          engine: "chatgpt",
          captureMethod: "manual_paste",
          answerText:
            "E2E Client is a strong AI visibility option. See https://e2e.example/ai-visibility for details.",
          locationContext: "US",
        })
      ).body,
    );
    const geoSnapshotId = idFrom(geoSnapshot);

    expect(
      (
        await tenantA.patch(`/api/geo-aeo/snapshots/${geoSnapshotId}`, {
          clientMentioned: true,
          clientCited: true,
          sentiment: "positive",
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/competitors`, {
          name: "E2E Competitor",
          websiteUrl: "https://competitor.example",
        })
      ).status,
    ).toBe(201);

    const citation = expectRecord(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/citations`, {
          snapshotId: geoSnapshotId,
          sourceName: "E2E Source",
          url: "https://e2e.example/ai-visibility",
          isClientOwned: true,
        })
      ).body,
    );
    expect(idFrom(citation)).toBeGreaterThan(0);

    expect(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/source-recommendations`, {
          sourceName: "Industry directory",
          sourceUrl: "https://directory.example/e2e",
          priority: "medium",
          status: "draft",
        })
      ).status,
    ).toBe(201);

    expect(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/schema-findings`, {
          pageUrl: "https://e2e.example/ai-visibility",
          issueType: "Missing FAQPage schema",
          severity: "medium",
          status: "draft",
        })
      ).status,
    ).toBe(201);

    const geoAnalysis = await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/analyze`);
    expect(geoAnalysis.status).toBe(200);
    expect(expectRecord(geoAnalysis.body).inserted).toBeTruthy();

    const geoFindings = await tenantA.get(`/api/geo-aeo/audits/${geoAuditId}/findings`);
    expect(geoFindings.status).toBe(200);
    const geoFindingRows = expectArray(geoFindings.body);
    if (geoFindingRows[0]) {
      expect(
        (
          await tenantA.patch(`/api/geo-aeo/findings/${idFrom(geoFindingRows[0])}`, {
            status: "approved",
          })
        ).status,
      ).toBe(200);
    }

    const geoActionPlan = await tenantA.post(
      `/api/geo-aeo/audits/${geoAuditId}/action-plan/generate`,
      {
        name: "E2E GEO AEO action plan",
        timeHorizonDays: 30,
      },
    );
    expect(geoActionPlan.status).toBe(201);
    const geoActionItems = expectArray(expectRecord(geoActionPlan.body).items);
    expect(geoActionItems.length).toBeGreaterThan(0);
    expect(
      (
        await tenantA.patch(`/api/geo-aeo/action-items/${idFrom(geoActionItems[0])}`, {
          status: "approved",
        })
      ).status,
    ).toBe(200);

    const monitoringRun = expectRecord(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/monitoring-runs`, {
          runMonth: "2026-06",
          baselineMonth: "2026-05",
          baselineScore: 70,
          currentScore: 78,
          baselineSnapshotCount: 1,
          currentSnapshotCount: 1,
        })
      ).body,
    );
    const monitoringRunId = idFrom(monitoringRun);
    expect(monitoringRun.scoreDelta).toBe(8);
    expect(
      (await tenantA.post(`/api/geo-aeo/monitoring-runs/${monitoringRunId}/approve`)).status,
    ).toBe(200);

    const geoPdfReport = expectRecord(
      (
        await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/report/generate`, {
          format: "pdf",
        })
      ).body,
    );
    const geoPdfReportId = idFrom(geoPdfReport);
    expect(geoPdfReport.format).toBe("pdf");

    const exportedGeoPdf = await tenantA.postText(`/api/geo-aeo/reports/${geoPdfReportId}/export`, {
      format: "pdf",
    });
    expect(exportedGeoPdf.status).toBe(200);
    expect(exportedGeoPdf.headers.get("content-type")).toContain("application/pdf");
    expect(exportedGeoPdf.text.startsWith("%PDF-1.4")).toBe(true);

    expect((await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/approve`)).status).toBe(200);
    const clientVisibleAudits = await tenantA.get("/api/geo-aeo/client/audits");
    expect(clientVisibleAudits.status).toBe(200);
    expect(expectArray(clientVisibleAudits.body).some((audit) => audit.id === geoAuditId)).toBe(
      true,
    );

    const clientMonitoringRuns = await tenantA.get(
      `/api/geo-aeo/client/audits/${geoAuditId}/monitoring-runs`,
    );
    expect(clientMonitoringRuns.status).toBe(200);
    expect(expectArray(clientMonitoringRuns.body)).toHaveLength(1);

    const billingUsage = await tenantA.get("/api/billing/usage");
    expect(billingUsage.status).toBe(200);
    expect(typeof expectRecord(billingUsage.body).aiTasksThisMonth).toBe("number");

    const checkoutDisabled = await tenantA.post("/api/billing/checkout", { planId: "agency" });
    expect(checkoutDisabled.status).toBe(501);

    const portalDisabled = await tenantA.post("/api/billing/portal");
    expect(portalDisabled.status).toBe(501);

    const unsignedWebhook = await unauthenticated.postRaw(
      "/api/billing/webhook",
      JSON.stringify({ type: "checkout.session.completed" }),
    );
    expect(unsignedWebhook.status).toBe(400);

    const checkoutWebhookPayload = JSON.stringify({
      id: `evt_checkout_${stamp}`,
      type: "checkout.session.completed",
      data: {
        object: {
          object: "checkout.session",
          customer: "cus_e2e",
          subscription: "sub_e2e",
          client_reference_id: String(tenantId),
          metadata: {
            tenantId: String(tenantId),
            planId: "agency",
          },
        },
      },
    });
    const checkoutWebhook = await unauthenticated.postRaw(
      "/api/billing/webhook",
      checkoutWebhookPayload,
      {
        "stripe-signature": stripeSignature(
          checkoutWebhookPayload,
          process.env.STRIPE_WEBHOOK_SECRET!,
        ),
      },
    );
    expect(checkoutWebhook.status).toBe(200);

    const upgradedSubscription = await tenantA.get("/api/billing/subscription");
    expect(upgradedSubscription.status).toBe(200);
    const upgradedSubscriptionBody = expectRecord(upgradedSubscription.body);
    expect(upgradedSubscriptionBody.plan).toBe("agency");
    expect(upgradedSubscriptionBody.status).toBe("active");
    expect(upgradedSubscriptionBody.seatsMax).toBe(5);
    expect(upgradedSubscriptionBody.stripeSubscriptionId).toBe("sub_e2e");
    expect(upgradedSubscriptionBody.currentPeriodEnd).toBeNull();
    expect(upgradedSubscriptionBody.cancelAtPeriodEnd).toBe(false);

    const periodEndUnix = 1893456000;
    const subscriptionUpdatedPayload = JSON.stringify({
      id: `evt_subscription_${stamp}`,
      type: "customer.subscription.updated",
      data: {
        object: {
          object: "subscription",
          id: "sub_e2e",
          customer: "cus_e2e",
          status: "active",
          current_period_end: periodEndUnix,
          cancel_at_period_end: true,
          metadata: {
            tenantId: String(tenantId),
            planId: "agency",
          },
        },
      },
    });
    const subscriptionUpdatedWebhook = await unauthenticated.postRaw(
      "/api/billing/webhook",
      subscriptionUpdatedPayload,
      {
        "stripe-signature": stripeSignature(
          subscriptionUpdatedPayload,
          process.env.STRIPE_WEBHOOK_SECRET!,
        ),
      },
    );
    expect(subscriptionUpdatedWebhook.status).toBe(200);

    const syncedSubscription = await tenantA.get("/api/billing/subscription");
    expect(syncedSubscription.status).toBe(200);
    const syncedSubscriptionBody = expectRecord(syncedSubscription.body);
    expect(syncedSubscriptionBody.plan).toBe("agency");
    expect(syncedSubscriptionBody.status).toBe("active");
    expect(syncedSubscriptionBody.currentPeriodEnd).toBe(
      new Date(periodEndUnix * 1000).toISOString(),
    );
    expect(syncedSubscriptionBody.cancelAtPeriodEnd).toBe(true);

    const paymentFailedPayload = JSON.stringify({
      id: `evt_payment_failed_${stamp}`,
      type: "invoice.payment_failed",
      data: {
        object: {
          object: "invoice",
          customer: "cus_e2e",
          subscription: "sub_e2e",
        },
      },
    });
    const paymentFailedWebhook = await unauthenticated.postRaw(
      "/api/billing/webhook",
      paymentFailedPayload,
      {
        "stripe-signature": stripeSignature(
          paymentFailedPayload,
          process.env.STRIPE_WEBHOOK_SECRET!,
        ),
      },
    );
    expect(paymentFailedWebhook.status).toBe(200);

    const pastDueSubscription = await tenantA.get("/api/billing/subscription");
    expect(pastDueSubscription.status).toBe(200);
    const pastDueSubscriptionBody = expectRecord(pastDueSubscription.body);
    expect(pastDueSubscriptionBody.plan).toBe("agency");
    expect(pastDueSubscriptionBody.status).toBe("past_due");

    const canceledWebhookPayload = JSON.stringify({
      id: `evt_cancel_${stamp}`,
      type: "customer.subscription.deleted",
      data: {
        object: {
          object: "subscription",
          id: "sub_e2e",
          customer: "cus_e2e",
          status: "canceled",
          metadata: {
            tenantId: String(tenantId),
            planId: "agency",
          },
        },
      },
    });
    const canceledWebhook = await unauthenticated.postRaw(
      "/api/billing/webhook",
      canceledWebhookPayload,
      {
        "stripe-signature": stripeSignature(
          canceledWebhookPayload,
          process.env.STRIPE_WEBHOOK_SECRET!,
        ),
      },
    );
    expect(canceledWebhook.status).toBe(200);

    const downgradedSubscription = await tenantA.get("/api/billing/subscription");
    expect(downgradedSubscription.status).toBe(200);
    const downgradedSubscriptionBody = expectRecord(downgradedSubscription.body);
    expect(downgradedSubscriptionBody.plan).toBe("solo");
    expect(downgradedSubscriptionBody.status).toBe("canceled");
    expect(downgradedSubscriptionBody.seatsMax).toBe(1);
    expect(downgradedSubscriptionBody.stripeSubscriptionId).toBeNull();
    expect(downgradedSubscriptionBody.currentPeriodEnd).toBeNull();
    expect(downgradedSubscriptionBody.cancelAtPeriodEnd).toBe(false);

    const apiKeyResponse = await tenantA.post("/api/api-keys", { name: "E2E API Key" });
    expect(apiKeyResponse.status).toBe(201);
    const apiKeyBody = expectRecord(apiKeyResponse.body);
    const rawApiKey = apiKeyBody.key;
    expect(typeof rawApiKey).toBe("string");
    expect((rawApiKey as string).startsWith("rm_")).toBe(true);

    const apiKeyAgent = new ApiAgent(baseUrl, {
      authorization: `Bearer ${rawApiKey as string}`,
    });
    const apiKeyDashboard = await apiKeyAgent.get("/api/tenant/dashboard");
    expect(apiKeyDashboard.status).toBe(200);
    expect(expectRecord(apiKeyDashboard.body).projectCount).toBe(1);

    const readOnlyApiKeyResponse = await tenantA.post("/api/api-keys", {
      name: "E2E Read-Only API Key",
      scopes: ["read"],
    });
    expect(readOnlyApiKeyResponse.status).toBe(201);
    const readOnlyApiKeyBody = expectRecord(readOnlyApiKeyResponse.body);
    expect(readOnlyApiKeyBody.scopes).toEqual(["read"]);
    const readOnlyApiKey = readOnlyApiKeyBody.key;
    expect(typeof readOnlyApiKey).toBe("string");
    const readOnlyApiKeyAgent = new ApiAgent(baseUrl, {
      authorization: `Bearer ${readOnlyApiKey as string}`,
    });
    expect((await readOnlyApiKeyAgent.get("/api/tenant/dashboard")).status).toBe(200);
    expect(
      (
        await readOnlyApiKeyAgent.post("/api/clients", {
          name: "Should Not Create",
          domain: "readonly.example",
          industry: "SaaS",
        })
      ).status,
    ).toBe(403);

    const invalidScopeKey = await tenantA.post("/api/api-keys", {
      name: "Invalid Scope API Key",
      scopes: ["admin"],
    });
    expect(invalidScopeKey.status).toBe(400);
    expect((await tenantA.delete("/api/api-keys/not-a-number")).status).toBe(400);
    expect((await tenantA.delete("/api/api-keys/1e2")).status).toBe(400);
    expect((await tenantA.patch("/api/team/1e2", { role: "agency_user" })).status).toBe(400);
    expect((await tenantA.patch("/api/team/not-a-number", { role: "agency_user" })).status).toBe(
      400,
    );
    expect((await tenantA.delete("/api/team/1e2")).status).toBe(400);
    expect((await tenantA.delete("/api/team/not-a-number")).status).toBe(400);
    expect((await tenantA.delete("/api/team/invitations/1e2")).status).toBe(400);
    expect((await tenantA.delete("/api/team/invitations/not-a-number")).status).toBe(400);

    await db
      .update(apiKeysTable)
      .set({ scopes: ["admin"] })
      .where(eq(apiKeysTable.id, idFrom(apiKeyBody)));
    expect((await apiKeyAgent.get("/api/tenant/dashboard")).status).toBe(401);

    const revokeKey = await tenantA.delete(`/api/api-keys/${idFrom(apiKeyBody)}`);
    expect(revokeKey.status).toBe(204);
    expect((await tenantA.delete(`/api/api-keys/${idFrom(readOnlyApiKeyBody)}`)).status).toBe(204);
    expect((await apiKeyAgent.get("/api/tenant/dashboard")).status).toBe(401);

    const readAllNotifications = await tenantA.patch("/api/notifications/read-all");
    expect(readAllNotifications.status).toBe(200);
    expect(expectRecord(readAllNotifications.body).ok).toBe(true);
    expect((await tenantA.patch("/api/notifications/not-a-number/read")).status).toBe(400);
    expect((await tenantA.delete("/api/notifications/not-a-number")).status).toBe(400);

    const tenantB = new ApiAgent(baseUrl);
    const registeredB = await tenantB.post("/api/auth/register", {
      email: `tenant-b-${stamp}@example.com`,
      password: "CorrectHorseBatteryStaple!42",
      fullName: "Tenant B Admin",
      tenantName: `Tenant B ${stamp}`,
    });
    expect(registeredB.status).toBe(201);

    const clientB = expectRecord(
      (
        await tenantB.post("/api/clients", {
          name: "Tenant B Client",
          domain: "tenant-b.example",
          industry: "SaaS",
        })
      ).body,
    );
    const projectB = expectRecord(
      (
        await tenantB.post("/api/projects", {
          clientId: idFrom(clientB),
          name: "Tenant B Project",
          targetDomain: "tenant-b.example",
          locale: "en-US",
        })
      ).body,
    );
    const projectBId = idFrom(projectB);

    const tenantBBrief = expectRecord(
      (
        await tenantB.post(`/api/projects/${projectBId}/briefs`, {
          title: "Tenant B Brief",
        })
      ).body,
    );
    expect(
      (
        await tenantB.patch(`/api/projects/${projectBId}/briefs/${idFrom(tenantBBrief)}`, {
          assignedTo: tenantAUserId,
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await tenantB.post(`/api/projects/${projectBId}/calendar`, {
          title: "Cross-tenant brief link",
          briefId,
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await tenantB.post("/api/comments", {
          entityType: "project",
          entityId: projectId,
          body: "Cross-tenant project comment",
        })
      ).status,
    ).toBe(404);
    expect(
      (await tenantB.get(`/api/comments?entityType=project&entityId=${projectId}`)).status,
    ).toBe(404);

    expect(
      (
        await tenantB.put("/api/custom-field-values", {
          fieldId: idFrom(customField),
          entityType: "project",
          entityId: projectBId,
          value: "high",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await tenantB.put("/api/custom-field-values", {
          fieldId: idFrom(customField),
          entityType: "project",
          entityId: projectId,
          value: "high",
        })
      ).status,
    ).toBe(400);
    expect(
      (await tenantB.get(`/api/custom-field-values?entityType=project&entityId=${projectId}`))
        .status,
    ).toBe(404);

    expect(
      (
        await tenantA.patch(`/api/report-schedules/${idFrom(reportSchedule)}`, {
          projectId: projectBId,
        })
      ).status,
    ).toBe(404);

    expect((await tenantA.get("/api/clients/not-a-number")).status).toBe(400);
    expect((await tenantA.patch("/api/clients/not-a-number", { name: "Bad" })).status).toBe(400);
    expect((await tenantA.delete("/api/clients/not-a-number")).status).toBe(400);
    expect((await tenantA.get("/api/clients/1e2/projects")).status).toBe(400);
    expect(
      (
        await tenantA.post("/api/clients/1e2/projects", {
          clientId,
          name: "Bad",
          targetDomain: "bad.example",
          locale: "en-US",
        })
      ).status,
    ).toBe(400);
    expect((await tenantA.get("/api/clients/1e2/projects/1e2")).status).toBe(400);
    expect(
      (await tenantA.patch("/api/clients/1e2/projects/1e2", { name: "Bad Project" })).status,
    ).toBe(400);
    expect((await tenantA.delete("/api/clients/1e2/projects/1e2")).status).toBe(400);
    expect((await tenantB.get(`/api/clients/${clientId}`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}`)).status).toBe(404);
    expect((await tenantB.get(`/api/clients/${clientId}/projects`)).status).toBe(404);
    expect((await tenantB.get(`/api/clients/${clientId}/projects/${projectId}`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/keywords`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/clusters`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/briefs`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/reports`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/calendar`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/competitors`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/rankings`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/report-schedules`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/export/keywords.csv`)).status).toBe(404);
    expect((await tenantB.get(`/api/projects/${projectId}/export/project.json`)).status).toBe(404);
  }, 30000);

  it("keeps AI-returned and client-supplied cluster ids scoped to the caller tenant", async () => {
    const stamp = Date.now();
    const tenantA = new ApiAgent(baseUrl);
    expect(
      (
        await tenantA.post("/api/auth/register", {
          email: `cluster-tenant-a-${stamp}@example.com`,
          password: "CorrectHorseBatteryStaple!42",
          fullName: "Cluster Tenant A Admin",
          tenantName: `Cluster Tenant A ${stamp}`,
        })
      ).status,
    ).toBe(201);

    const tenantB = new ApiAgent(baseUrl);
    expect(
      (
        await tenantB.post("/api/auth/register", {
          email: `cluster-tenant-b-${stamp}@example.com`,
          password: "CorrectHorseBatteryStaple!42",
          fullName: "Cluster Tenant B Admin",
          tenantName: `Cluster Tenant B ${stamp}`,
        })
      ).status,
    ).toBe(201);

    const clientA = expectRecord(
      (
        await tenantA.post("/api/clients", {
          name: "Cluster Client A",
          domain: "cluster-a.example",
          industry: "SaaS",
        })
      ).body,
    );
    const projectA = expectRecord(
      (
        await tenantA.post("/api/projects", {
          clientId: idFrom(clientA),
          name: "Cluster Project A",
          targetDomain: "cluster-a.example",
          locale: "en-US",
        })
      ).body,
    );
    const projectAId = idFrom(projectA);

    const clientB = expectRecord(
      (
        await tenantB.post("/api/clients", {
          name: "Cluster Client B",
          domain: "cluster-b.example",
          industry: "SaaS",
        })
      ).body,
    );
    const projectB = expectRecord(
      (
        await tenantB.post("/api/projects", {
          clientId: idFrom(clientB),
          name: "Cluster Project B",
          targetDomain: "cluster-b.example",
          locale: "en-US",
        })
      ).body,
    );
    const projectBId = idFrom(projectB);

    const attackerKeyword = expectRecord(
      (
        await tenantA.post(`/api/projects/${projectAId}/keywords`, {
          phrase: "attacker owned cluster keyword",
          searchVolume: 100,
          cpc: 1.1,
          kd: 11,
          intent: "informational",
        })
      ).body,
    );
    const attackerKeywordId = idFrom(attackerKeyword);

    const victimKeyword = expectRecord(
      (
        await tenantB.post(`/api/projects/${projectBId}/keywords`, {
          phrase: "victim private keyword",
          searchVolume: 200,
          cpc: 2.2,
          kd: 22,
          intent: "commercial",
        })
      ).body,
    );
    const victimKeywordId = idFrom(victimKeyword);

    const victimCluster = expectRecord(
      (
        await tenantB.post(`/api/projects/${projectBId}/clusters`, {
          label: "Victim Private Cluster",
          clusterType: "cluster",
        })
      ).body,
    );
    const victimClusterId = idFrom(victimCluster);

    const rejectedKeywordPatch = await tenantA.patch(
      `/api/projects/${projectAId}/keywords/${attackerKeywordId}`,
      { clusterId: victimClusterId },
    );
    expect(rejectedKeywordPatch.status).toBe(400);

    const rejectedBrief = await tenantA.post(`/api/projects/${projectAId}/briefs`, {
      clusterId: victimClusterId,
      title: "Should Not Bind Cross-Tenant Cluster",
      targetWordCount: 1200,
    });
    expect(rejectedBrief.status).toBe(400);

    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
    let fakeOpenAiStarted = false;
    const fakeOpenAi = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  clusters: [
                    {
                      label: "Injected Cross Tenant Group",
                      keywordIds: [attackerKeywordId, victimKeywordId],
                    },
                  ],
                }),
              },
            },
          ],
        }),
      );
    });

    try {
      const fakeOpenAiBaseUrl = await new Promise<string>((resolve, reject) => {
        fakeOpenAi.once("error", reject);
        fakeOpenAi.listen(0, "127.0.0.1", () => {
          fakeOpenAiStarted = true;
          fakeOpenAi.off("error", reject);
          const address = fakeOpenAi.address();
          if (!address || typeof address === "string") {
            reject(new Error("Fake OpenAI server did not expose a TCP port."));
            return;
          }
          resolve(`http://127.0.0.1:${address.port}/v1`);
        });
      });

      process.env.OPENAI_API_KEY = "test-openai-key";
      process.env.OPENAI_BASE_URL = fakeOpenAiBaseUrl;

      const autoCluster = await tenantA.post(`/api/projects/${projectAId}/clusters/auto`);
      expect(autoCluster.status).toBe(201);
      const createdClusters = expectArray(expectRecord(autoCluster.body).clusters);
      expect(createdClusters).toHaveLength(1);
      const createdClusterId = idFrom(createdClusters[0]);

      const attackerCluster = await tenantA.get(
        `/api/projects/${projectAId}/clusters/${createdClusterId}`,
      );
      expect(attackerCluster.status).toBe(200);
      const attackerClusterKeywords = expectArray(expectRecord(attackerCluster.body).keywords);
      expect(attackerClusterKeywords.map((keyword) => idFrom(keyword))).toEqual([
        attackerKeywordId,
      ]);
      expect(attackerClusterKeywords.some((keyword) => idFrom(keyword) === victimKeywordId)).toBe(
        false,
      );

      const victimKeywordAfter = await tenantB.get(
        `/api/projects/${projectBId}/keywords/${victimKeywordId}`,
      );
      expect(victimKeywordAfter.status).toBe(200);
      expect(expectRecord(victimKeywordAfter.body).clusterId).toBeNull();
    } finally {
      if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalOpenAiKey;

      if (originalOpenAiBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
      else process.env.OPENAI_BASE_URL = originalOpenAiBaseUrl;

      if (fakeOpenAiStarted) {
        await new Promise<void>((resolve, reject) => {
          fakeOpenAi.close((err) => (err ? reject(err) : resolve()));
        });
      }
    }
  }, 30000);
});
