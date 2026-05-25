import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";

class ApiAgent {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(path, { method = "GET", body } = {}) {
    const headers = new Headers();
    headers.set("accept", "application/json");
    if (body !== undefined) headers.set("content-type", "application/json");
    if (this.cookie) headers.set("cookie", this.cookie);

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

    return {
      status: response.status,
      body: parsed,
    };
  }
}

function deepObject(depth) {
  let root = { leaf: "x" };
  for (let i = 0; i < depth; i += 1) {
    root = { nested: root };
  }
  return root;
}

const phase = "phase2-mutation";
const stamp = new Date().toISOString();
const results = {
  phase,
  executedAt: stamp,
  cases: [],
  summary: {
    total: 0,
    gracefulRejects: 0,
    serverErrors: 0,
    unexpectedSuccesses: 0,
  },
};

function compactBody(value) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= 4000) return value;
    return {
      truncated: true,
      preview: `${serialized.slice(0, 4000)}...<truncated>`,
      length: serialized.length,
    };
  } catch (error) {
    return { compactError: String(error?.message ?? error) };
  }
}

let server;

try {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

  const { ensureSessionTable } = await import("../../artifacts/api-server/src/lib/session-table.ts");
  await ensureSessionTable();
  const { default: app } = await import("../../artifacts/api-server/src/app.ts");

  server = await new Promise((resolve, reject) => {
    const listener = createServer(app);
    listener.listen(0, "127.0.0.1", () => resolve(listener));
    listener.on("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind API test server.");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const agent = new ApiAgent(baseUrl);

  const register = await agent.request("/api/auth/register", {
    method: "POST",
    body: {
      email: `chaos-phase2-${Date.now()}@example.com`,
      password: "CorrectHorseBatteryStaple!42",
      fullName: "Chaos Operator",
      tenantName: "Chaos Tenant",
    },
  });
  if (register.status !== 201) {
    throw new Error(`Unable to bootstrap session for mutation phase: ${register.status}`);
  }

  const cases = [
    {
      name: "invalid-integration-credential-types",
      path: "/api/integrations",
      method: "POST",
      body: { provider: "semrush", credentials: { apiKey: { nested: "not-a-string" } } },
      expect: "4xx",
    },
    {
      name: "deeply-nested-tenant-patch",
      path: "/api/tenant",
      method: "PATCH",
      body: { whiteLabelConfig: deepObject(1400) },
      expect: "4xx-or-5xx",
    },
    {
      name: "massive-integer-project-create",
      path: "/api/projects",
      method: "POST",
      body: {
        clientId: Number.MAX_SAFE_INTEGER,
        name: "overflow-probe",
        targetDomain: "x".repeat(2048),
        locale: "en-US",
      },
      expect: "4xx",
    },
    {
      name: "keywords-import-malformed-array",
      path: "/api/projects/1/keywords/import",
      method: "POST",
      body: { source: "manual", keywords: { not: "an-array" } },
      expect: "4xx",
    },
    {
      name: "api-key-create-null-name",
      path: "/api/api-keys",
      method: "POST",
      body: { name: null, scopes: ["read"] },
      expect: "4xx",
    },
    {
      name: "team-invite-special-char-flood",
      path: "/api/team/invite",
      method: "POST",
      body: {
        email: `bad\u0000mail+${Date.now()}@example.com`,
        role: "agency_user",
        fullName: "';DROP TABLE users;--".repeat(20),
      },
      expect: "4xx-or-5xx",
    },
  ];

  for (const testCase of cases) {
    const started = Date.now();
    let response;
    try {
      // JSON serialization of BigInt intentionally throws; this is part of attack surface logging.
      response = await agent.request(testCase.path, {
        method: testCase.method,
        body: testCase.body,
      });
      const durationMs = Date.now() - started;
      const statusClass = Math.floor(response.status / 100);
      const outcome =
        statusClass === 4 ? "graceful-reject" : statusClass === 5 ? "server-error" : "unexpected-success";
      results.cases.push({
        ...testCase,
        durationMs,
        status: response.status,
        outcome,
        body: compactBody(response.body),
      });
    } catch (error) {
      const durationMs = Date.now() - started;
      results.cases.push({
        ...testCase,
        durationMs,
        status: null,
        outcome: "client-or-serialization-exception",
        error: String(error?.message ?? error),
      });
    }
  }

  results.summary.total = results.cases.length;
  results.summary.gracefulRejects = results.cases.filter((c) => c.outcome === "graceful-reject").length;
  results.summary.serverErrors = results.cases.filter((c) => c.outcome === "server-error").length;
  results.summary.unexpectedSuccesses = results.cases.filter((c) => c.outcome === "unexpected-success").length;

  await mkdir("artifacts/chaos", { recursive: true });
  await writeFile(
    "artifacts/chaos/phase2-mutation-results.json",
    `${JSON.stringify(results, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify(results.summary));
} finally {
  if (server) {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}
