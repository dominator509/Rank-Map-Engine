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

    await tenantA.post(`/api/projects/${projectId}/clusters/${pillarId}/approve`);

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

    const generatedBrief = await tenantA.post(
      `/api/projects/${projectId}/briefs/${briefId}/generate`,
    );
    expect(generatedBrief.status).toBe(200);
    expect(expectRecord(expectRecord(generatedBrief.body).brief).outline).toBeTruthy();

    const report = await tenantA.post(`/api/projects/${projectId}/reports`, {
      type: "project_summary",
      format: "json",
    });
    expect(report.status).toBe(201);

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

    const geoActionPlan = await tenantA.post(`/api/geo-aeo/audits/${geoAuditId}/action-plan/generate`, {
      name: "E2E GEO AEO action plan",
      timeHorizonDays: 30,
    });
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
    expect((await tenantA.post(`/api/geo-aeo/monitoring-runs/${monitoringRunId}/approve`)).status).toBe(200);

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
    expect(expectArray(clientVisibleAudits.body).some((audit) => audit.id === geoAuditId)).toBe(true);

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

    const tenantB = new ApiAgent(baseUrl);
    const registeredB = await tenantB.post("/api/auth/register", {
      email: `tenant-b-${stamp}@example.com`,
      password: "CorrectHorseBatteryStaple!42",
      fullName: "Tenant B Admin",
      tenantName: `Tenant B ${stamp}`,
    });
    expect(registeredB.status).toBe(201);
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
