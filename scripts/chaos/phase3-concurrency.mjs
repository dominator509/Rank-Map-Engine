import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";

class ApiAgent {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(path, { method = "GET", body, signal } = {}) {
    const headers = new Headers();
    headers.set("accept", "application/json");
    if (body !== undefined) headers.set("content-type", "application/json");
    if (this.cookie) headers.set("cookie", this.cookie);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
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
  phase: "phase3-concurrency",
  executedAt: new Date().toISOString(),
  checks: [],
};

let server;

function ensureChaosPrerequisites() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      [
        "DATABASE_URL is required for chaos phase 3 because it boots the API against a real test database.",
        "Run with a disposable database and the TypeScript executor, for example:",
        "  .\\node_modules\\.bin\\tsx.cmd scripts/chaos/phase3-concurrency.mjs",
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
  if (!address || typeof address === "string") throw new Error("Failed to bind chaos API server.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const agent = new ApiAgent(baseUrl);

  const register = await agent.request("/api/auth/register", {
    method: "POST",
    body: {
      email: `chaos-phase3-${Date.now()}@example.com`,
      password: "CorrectHorseBatteryStaple!42",
      fullName: "Chaos Concurrency Operator",
      tenantName: "Chaos Concurrency Tenant",
    },
  });
  if (register.status !== 201) throw new Error(`Bootstrap failed: ${register.status}`);

  const client = await agent.request("/api/clients", {
    method: "POST",
    body: { name: "Chaos Concurrent Client", domain: "chaos.example", industry: "SaaS" },
  });
  if (client.status !== 201) throw new Error(`Client bootstrap failed: ${client.status}`);
  const clientId = client.body?.id;

  const projectBurst = 30;
  const projectResponses = await Promise.all(
    Array.from({ length: projectBurst }).map((_, idx) =>
      agent.request("/api/projects", {
        method: "POST",
        body: {
          clientId,
          name: `chaos-parallel-${idx % 3}`,
          targetDomain: `parallel-${idx}.example`,
          locale: "en-US",
        },
      }),
    ),
  );
  const projectSummary = {
    total: projectResponses.length,
    statusCounts: projectResponses.reduce((acc, response) => {
      acc[response.status] = (acc[response.status] ?? 0) + 1;
      return acc;
    }, {}),
  };
  results.checks.push({ name: "parallel-project-creation", ...projectSummary });

  const inviteEmail = `duplicate-invite-${Date.now()}@example.com`;
  const inviteRace = await Promise.all(
    Array.from({ length: 12 }).map(() =>
      agent.request("/api/team/invite", {
        method: "POST",
        body: { email: inviteEmail, role: "agency_user", fullName: "Duplicate Invite Probe" },
      }),
    ),
  );
  const inviteSummary = {
    total: inviteRace.length,
    statusCounts: inviteRace.reduce((acc, response) => {
      acc[response.status] = (acc[response.status] ?? 0) + 1;
      return acc;
    }, {}),
  };
  results.checks.push({ name: "duplicate-invite-race", ...inviteSummary });

  const aborted = [];
  for (let i = 0; i < 10; i += 1) {
    const controller = new AbortController();
    const p = agent
      .request("/api/projects", {
        method: "POST",
        body: {
          clientId,
          name: `abort-${i}`,
          targetDomain: "abort.example",
          locale: "en-US",
        },
        signal: controller.signal,
      })
      .then((response) => ({ kind: "response", status: response.status }))
      .catch((error) => ({ kind: "aborted", error: String(error?.name ?? error) }));
    controller.abort();
    aborted.push(p);
  }
  const abortResults = await Promise.all(aborted);
  results.checks.push({
    name: "client-abort-mid-request",
    total: abortResults.length,
    aborted: abortResults.filter((r) => r.kind === "aborted").length,
    responded: abortResults.filter((r) => r.kind === "response").length,
  });

  const projects = await agent.request("/api/projects");
  const invites = await agent.request("/api/team/invitations");
  const projectList = Array.isArray(projects.body) ? projects.body : [];
  const inviteList = Array.isArray(invites.body) ? invites.body : [];
  results.checks.push({
    name: "post-race-db-state",
    projectRows: projectList.length,
    invitationRows: inviteList.length,
    uniqueInvitationEmails: new Set(inviteList.map((i) => i.email)).size,
  });

  await mkdir("artifacts/chaos", { recursive: true });
  await writeFile(
    "artifacts/chaos/phase3-concurrency-results.json",
    `${JSON.stringify(results, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify(results, null, 2));
} finally {
  if (server)
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
