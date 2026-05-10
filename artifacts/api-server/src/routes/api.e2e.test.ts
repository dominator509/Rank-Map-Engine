import type { Server } from "node:http";
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
  });

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

    const revokeKey = await tenantA.delete(`/api/api-keys/${idFrom(apiKeyBody)}`);
    expect(revokeKey.status).toBe(204);
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
  });
});
