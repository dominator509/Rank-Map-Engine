import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";

class ApiAgent {
  constructor(baseUrl, authorization) {
    this.baseUrl = baseUrl;
    this.authorization = authorization;
    this.cookie = "";
  }

  async request(path, { method = "GET", body } = {}) {
    const headers = new Headers();
    headers.set("accept", "application/json");
    if (body !== undefined) headers.set("content-type", "application/json");
    if (this.cookie) headers.set("cookie", this.cookie);
    if (this.authorization) headers.set("authorization", this.authorization);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] ?? "";
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    return { status: response.status, body: parsed };
  }
}

const results = {
  phase: "phase4-persona-derailment",
  executedAt: new Date().toISOString(),
  scenarios: [],
};

let server;

function ensureChaosPrerequisites() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      [
        "DATABASE_URL is required for chaos phase 4 because it boots the API against a real test database.",
        "Run with a disposable database and the TypeScript executor, for example:",
        "  .\\node_modules\\.bin\\tsx.cmd scripts/chaos/phase4-persona-derailment.mjs",
      ].join("\n"),
    );
  }
}

try {
  ensureChaosPrerequisites();

  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

  const { ensureSessionTable } =
    await import("../../artifacts/api-server/src/lib/session-table.ts");
  await ensureSessionTable();
  const { default: app } = await import("../../artifacts/api-server/src/app.ts");

  server = await new Promise((resolve, reject) => {
    const listener = createServer(app);
    listener.listen(0, "127.0.0.1", () => resolve(listener));
    listener.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind API server.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const user = new ApiAgent(baseUrl);
  const loginEmail = `chaos-phase4-${Date.now()}@example.com`;
  const loginPassword = "CorrectHorseBatteryStaple!42";

  const register = await user.request("/api/auth/register", {
    method: "POST",
    body: {
      email: loginEmail,
      password: loginPassword,
      fullName: "Chaos Persona Operator",
      tenantName: "Chaos Persona Tenant",
    },
  });
  if (register.status !== 201) throw new Error(`Bootstrap failed: ${register.status}`);

  const outOfOrderClusterApprove = await user.request("/api/projects/999/clusters/999/approve", {
    method: "POST",
  });
  results.scenarios.push({
    name: "approve-nonexistent-cluster-before-project-init",
    status: outOfOrderClusterApprove.status,
    body: outOfOrderClusterApprove.body,
  });

  const orphanBriefAttempt = await user.request("/api/projects/999/briefs", {
    method: "POST",
    body: { clusterId: 999, title: "Orphan brief", targetWordCount: 1200 },
  });
  results.scenarios.push({
    name: "create-brief-before-project-and-cluster",
    status: orphanBriefAttempt.status,
    body: orphanBriefAttempt.body,
  });

  const client = await user.request("/api/clients", {
    method: "POST",
    body: { name: "Persona Client", domain: "persona.example", industry: "SaaS" },
  });
  const project = await user.request("/api/projects", {
    method: "POST",
    body: {
      clientId: client.body?.id,
      name: "Persona Project",
      targetDomain: "persona.example",
      locale: "en-US",
    },
  });

  const apiKey = await user.request("/api/api-keys", {
    method: "POST",
    body: { name: "Persona Replay Key", scopes: ["read"] },
  });
  const apiKeyId = apiKey.body?.id;
  const replayAgent = new ApiAgent(baseUrl, `Bearer ${apiKey.body?.key}`);

  const beforeLogoutRead = await replayAgent.request("/api/tenant/dashboard");
  await user.request("/api/auth/logout", { method: "POST" });
  const afterLogoutRead = await replayAgent.request("/api/tenant/dashboard");
  results.scenarios.push({
    name: "api-key-reuse-after-session-logout",
    beforeLogoutStatus: beforeLogoutRead.status,
    afterLogoutStatus: afterLogoutRead.status,
  });

  const reloggedUser = new ApiAgent(baseUrl);
  await reloggedUser.request("/api/auth/login", {
    method: "POST",
    body: { email: loginEmail, password: loginPassword },
  });
  await reloggedUser.request(`/api/api-keys/${apiKeyId}`, { method: "DELETE" });
  const revokedReplay = await replayAgent.request("/api/tenant/dashboard");
  results.scenarios.push({
    name: "revoked-api-key-replay",
    status: revokedReplay.status,
    body: revokedReplay.body,
  });

  const tripleBriefSubmit = [];
  for (let i = 0; i < 3; i += 1) {
    tripleBriefSubmit.push(
      user.request(`/api/projects/${project.body?.id}/briefs`, {
        method: "POST",
        body: { clusterId: 999999, title: `Out-of-order brief ${i}`, targetWordCount: 800 },
      }),
    );
  }
  const tripleResults = await Promise.all(tripleBriefSubmit);
  results.scenarios.push({
    name: "repeated-step3-submit-without-step1-step2",
    statusCounts: tripleResults.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
  });

  await mkdir("artifacts/chaos", { recursive: true });
  await writeFile(
    "artifacts/chaos/phase4-persona-results.json",
    `${JSON.stringify(results, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (server)
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
