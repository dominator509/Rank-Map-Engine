import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(
  repoRoot,
  process.env.STAGING_EVIDENCE_DIR ?? path.join("artifacts", "staging-launch"),
);

const baseUrl = normalizeBaseUrl(requiredEnv("STAGING_BASE_URL"));
const healthCheckToken = requiredEnv("HEALTH_CHECK_TOKEN");
const operator = process.env.STAGING_OPERATOR?.trim() || process.env.USERNAME || "unknown";
const keywordCount = readPositiveInt("STAGING_KEYWORD_COUNT", 250);
const concurrency = readPositiveInt("STAGING_LOAD_CONCURRENCY", 5);
const requestsPerEndpoint = readPositiveInt("STAGING_LOAD_REQUESTS", 25);
const pageBudgetMs = readPositiveInt("STAGING_PAGE_BUDGET_MS", 5000);
const apiBudgetMs = readPositiveInt("STAGING_API_P95_BUDGET_MS", 1500);
const unique = Date.now();

const state = {
  clientId: 0,
  cookie: "",
  email: process.env.STAGING_TEST_EMAIL?.trim() || `staging-launch-${unique}@rankmap.test`,
  password: process.env.STAGING_TEST_PASSWORD?.trim() || "StagingLaunch!234",
  projectId: 0,
  registered: false,
};

const evidence = {
  baseUrl,
  budgets: {
    apiP95Ms: apiBudgetMs,
    concurrency,
    pageVisibleMs: pageBudgetMs,
    requestsPerEndpoint,
  },
  dataset: {
    aiTasks: 0,
    clients: 1,
    keywords: keywordCount,
    projects: 1,
    reports: 0,
  },
  endedAt: "",
  errors: [],
  load: [],
  operator,
  pages: [],
  result: "pending",
  runner: "pnpm run staging:smoke-load",
  smoke: [],
  startedAt: new Date().toISOString(),
};

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
}

function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (pathname === "/api/healthz/detailed" && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${healthCheckToken}`);
  }
  if (state.cookie) headers.set("cookie", state.cookie);

  const started = performance.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const durationMs = Math.round(performance.now() - started);

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) state.cookie = setCookie.split(";")[0];

  const text = await response.text();
  const data = options.responseType === "text" ? null : text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${pathname} returned ${response.status}: ${text}`);
  }

  return { data, durationMs, status: response.status, text };
}

async function recordSmoke(name, run) {
  const started = performance.now();
  try {
    const details = await run();
    const durationMs = Math.round(performance.now() - started);
    evidence.smoke.push({ details, durationMs, name, status: "pass" });
    return details;
  } catch (err) {
    const durationMs = Math.round(performance.now() - started);
    const message = err instanceof Error ? err.message : String(err);
    evidence.smoke.push({ durationMs, error: message, name, status: "fail" });
    evidence.errors.push(`${name}: ${message}`);
    throw err;
  }
}

async function ensureAccount() {
  if (process.env.STAGING_TEST_EMAIL && process.env.STAGING_TEST_PASSWORD) {
    await request("/api/auth/login", {
      method: "POST",
      body: { email: state.email, password: state.password },
    });
    return { mode: "existing-user", email: state.email };
  }

  await request("/api/auth/register", {
    method: "POST",
    body: {
      email: state.email,
      password: state.password,
      fullName: "Staging Launch Runner",
      tenantName: `Staging Launch ${unique}`,
    },
  });
  state.registered = true;
  return { mode: "registered-user", email: state.email };
}

async function seedWorkspace() {
  const client = await request("/api/clients", {
    method: "POST",
    body: {
      domain: `staging-launch-${unique}.example.com`,
      industry: "Software",
      name: `Staging Launch Client ${unique}`,
    },
  });
  state.clientId = client.data.id;

  const project = await request("/api/projects", {
    method: "POST",
    body: {
      clientId: state.clientId,
      locale: "en-US",
      name: `Staging Launch Project ${unique}`,
      targetDomain: `staging-launch-${unique}.example.com`,
    },
  });
  state.projectId = project.data.id;

  const keywords = Array.from({ length: keywordCount }, (_, index) => ({
    cpc: 1 + index / 100,
    intent: ["informational", "commercial", "transactional", "navigational"][index % 4],
    kd: 10 + (index % 80),
    phrase: `staging launch keyword ${unique} ${index + 1}`,
    searchVolume: 5000 - index,
  }));

  const imported = await request(`/api/projects/${state.projectId}/keywords/import`, {
    method: "POST",
    body: { keywords, source: "manual" },
  });

  const report = await request(`/api/projects/${state.projectId}/reports`, {
    method: "POST",
    body: { format: "json", type: "project_summary" },
  });
  evidence.dataset.reports = 1;

  const clusters = await request(`/api/projects/${state.projectId}/clusters/auto`, {
    method: "POST",
  });
  evidence.dataset.aiTasks = 1;

  return {
    clientId: state.clientId,
    importedKeywords: imported.data.imported,
    projectId: state.projectId,
    reportId: report.data.id,
    taskId: clusters.data.taskId,
  };
}

function percentile(values, pct) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function summarize(values) {
  return {
    maxMs: Math.round(Math.max(...values)),
    p50Ms: Math.round(percentile(values, 50)),
    p95Ms: Math.round(percentile(values, 95)),
  };
}

async function measureLoad(name, pathname, options = {}) {
  const durations = [];
  let failures = 0;
  let next = 0;

  async function worker() {
    while (next < requestsPerEndpoint) {
      next += 1;
      try {
        const result = await request(pathname, options);
        options.validate?.(result);
        durations.push(result.durationMs);
      } catch {
        failures += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const summary = summarize(durations.length > 0 ? durations : [Number.POSITIVE_INFINITY]);
  const result = {
    concurrency,
    failures,
    name,
    path: pathname,
    requests: requestsPerEndpoint,
    ...summary,
    status: failures === 0 && summary.p95Ms <= apiBudgetMs ? "pass" : "fail",
  };
  evidence.load.push(result);
  if (result.status !== "pass") {
    evidence.errors.push(`${name}: p95=${result.p95Ms}ms failures=${failures}`);
  }
}

async function measurePage(page, name, pathname, selector) {
  const started = performance.now();
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
  await page.locator(selector).waitFor({ state: "visible", timeout: pageBudgetMs });
  await page.waitForLoadState("networkidle", { timeout: pageBudgetMs }).catch(() => {});
  const durationMs = Math.round(performance.now() - started);
  const result = {
    durationMs,
    name,
    path: pathname,
    status: durationMs <= pageBudgetMs ? "pass" : "fail",
  };
  evidence.pages.push(result);
  if (result.status !== "pass") {
    evidence.errors.push(`${name}: page visible in ${durationMs}ms`);
  }
}

async function runBrowserSmoke() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
  const browserErrors = [];
  page.on("pageerror", (err) => browserErrors.push(err.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(state.email);
  await page.getByLabel("Password").fill(state.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.locator('main:has-text("Dashboard")').waitFor({ state: "visible" });

  await measurePage(page, "dashboard", "/dashboard", 'main:has-text("Dashboard")');
  await measurePage(
    page,
    "clients",
    "/clients",
    `main:has-text("Staging Launch Client ${unique}")`,
  );
  await measurePage(
    page,
    "project.detail",
    `/clients/${state.clientId}/projects/${state.projectId}`,
    `main:has-text("staging launch keyword ${unique} 1")`,
  );

  await page.setViewportSize({ height: 844, width: 390 });
  await measurePage(page, "mobile.dashboard", "/dashboard", 'main:has-text("Dashboard")');
  await browser.close();

  if (browserErrors.length > 0) {
    evidence.errors.push(`browser runtime errors: ${browserErrors.join("; ")}`);
  }
  return { browserErrors };
}

function markdownTable(rows) {
  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

async function writeEvidence() {
  evidence.endedAt = new Date().toISOString();
  evidence.result = evidence.errors.length === 0 ? "pass" : "fail";
  await mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "staging-smoke-load-evidence.json");
  const mdPath = path.join(outputDir, "staging-smoke-load-evidence.md");
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);

  const p95Summary = evidence.load.map((item) => `${item.name} ${item.p95Ms}ms`).join(", ");
  const totalRequests = evidence.load.reduce((sum, item) => sum + item.requests, 0);
  const totalFailures = evidence.load.reduce((sum, item) => sum + item.failures, 0);
  const errorRate =
    totalRequests === 0 ? "n/a" : `${((totalFailures / totalRequests) * 100).toFixed(2)}%`;

  const markdown = `# Staging Smoke/Load Evidence

| Field | Value |
| --- | --- |
| Staging URL | ${baseUrl} |
| Test date | ${evidence.startedAt} |
| Dataset size | ${keywordCount} keywords, ${evidence.dataset.clients} client, ${evidence.dataset.projects} project, ${evidence.dataset.reports} report, ${evidence.dataset.aiTasks} AI task |
| Tool/runner | ${evidence.runner} |
| Peak virtual users / concurrency | ${concurrency} |
| Duration | ${new Date(evidence.endedAt).getTime() - new Date(evidence.startedAt).getTime()}ms |
| p95 latency summary | ${p95Summary} |
| Error rate | ${errorRate} |
| Operator | ${operator} |
| Result | ${evidence.result.toUpperCase()} |

## Smoke

${markdownTable([
  ["Check", "Status", "Duration", "Details"],
  ["---", "---", "---", "---"],
  ...evidence.smoke.map((item) => [
    item.name,
    item.status,
    `${item.durationMs}ms`,
    item.error ?? JSON.stringify(item.details),
  ]),
])}

## Load

${markdownTable([
  ["Endpoint", "Requests", "Concurrency", "p50", "p95", "Max", "Failures", "Status"],
  ["---", "---", "---", "---", "---", "---", "---", "---"],
  ...evidence.load.map((item) => [
    item.name,
    String(item.requests),
    String(item.concurrency),
    `${item.p50Ms}ms`,
    `${item.p95Ms}ms`,
    `${item.maxMs}ms`,
    String(item.failures),
    item.status,
  ]),
])}

## Pages

${markdownTable([
  ["Page", "Duration", "Status"],
  ["---", "---", "---"],
  ...evidence.pages.map((item) => [item.name, `${item.durationMs}ms`, item.status]),
])}

## Errors

${evidence.errors.length === 0 ? "None." : evidence.errors.map((error) => `- ${error}`).join("\n")}
`;

  await writeFile(mdPath, markdown);
  return { jsonPath, mdPath };
}

try {
  await recordSmoke("healthz.detailed", async () => {
    const health = await request("/api/healthz/detailed");
    return { responseTimeMs: health.data.responseTimeMs, status: health.data.status };
  });

  await recordSmoke("auth.account", ensureAccount);
  await recordSmoke("seed.workspace", seedWorkspace);
  await recordSmoke("browser.critical-pages", runBrowserSmoke);

  await measureLoad("healthz", "/api/healthz");
  await measureLoad("dashboard", "/api/tenant/dashboard");
  await measureLoad("clients", "/api/clients");
  await measureLoad("projects", `/api/projects?clientId=${state.clientId}`);
  await measureLoad("keywords", `/api/projects/${state.projectId}/keywords`, {
    validate: (result) => {
      if (result.data.length !== keywordCount) {
        throw new Error(`Expected ${keywordCount} keywords, received ${result.data.length}.`);
      }
    },
  });
  await measureLoad("keyword-export", `/api/projects/${state.projectId}/export/keywords.csv`, {
    responseType: "text",
    validate: (result) => {
      if (!result.text.includes(`staging launch keyword ${unique} ${keywordCount}`)) {
        throw new Error("Keyword export did not include the final seeded keyword.");
      }
    },
  });
  await measureLoad("project-export", `/api/projects/${state.projectId}/export/project.json`, {
    validate: (result) => {
      if (result.data?.keywords?.length !== keywordCount) {
        throw new Error("Project export keyword count did not match the seeded dataset.");
      }
    },
  });
  await measureLoad("ai-tasks", "/api/ai-tasks");

  const paths = await writeEvidence();
  console.log(`Staging smoke/load evidence written:\n${paths.mdPath}\n${paths.jsonPath}`);

  if (evidence.result !== "pass") {
    process.exitCode = 1;
  }
} catch (err) {
  evidence.errors.push(err instanceof Error ? err.message : String(err));
  const paths = await writeEvidence();
  console.error(`Staging smoke/load failed. Evidence written:\n${paths.mdPath}\n${paths.jsonPath}`);
  throw err;
}
