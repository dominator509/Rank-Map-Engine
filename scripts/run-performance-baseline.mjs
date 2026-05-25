import { spawn } from "node:child_process";
import net from "node:net";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

const containerName = `rankmap-perf-baseline-${Date.now()}`;
const postgresPort = String(await getFreePort());
const apiPort = String(await getFreePort());
const degradedApiPort = String(await getFreePort());
const databaseUrl = `postgresql://rankmap:rankmap@localhost:${postgresPort}/rankmap_perf_baseline`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const degradedApiUrl = `http://127.0.0.1:${degradedApiPort}`;
const managedProcesses = [];
const reportTypes = ["project_summary", "topical_authority", "content_pipeline"];
const healthCheckToken = "performance-baseline-health-token";

const budgets = [
  { name: "healthz", method: "GET", path: "/api/healthz", samples: 20, p95BudgetMs: 75 },
  { name: "auth.me", method: "GET", path: "/api/auth/me", samples: 20, p95BudgetMs: 150 },
  {
    name: "tenant.dashboard",
    method: "GET",
    path: "/api/tenant/dashboard",
    samples: 20,
    p95BudgetMs: 250,
  },
  { name: "clients.list", method: "GET", path: "/api/clients", samples: 20, p95BudgetMs: 250 },
  {
    name: "projects.list",
    method: "GET",
    path: () => `/api/projects?clientId=${state.clientId}`,
    samples: 20,
    p95BudgetMs: 250,
  },
  {
    name: "project.detail",
    method: "GET",
    path: () => `/api/projects/${state.projectId}`,
    samples: 20,
    p95BudgetMs: 200,
  },
  {
    name: "keywords.list",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/keywords`,
    samples: 20,
    p95BudgetMs: 300,
  },
  {
    name: "briefs.list",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/briefs`,
    samples: 20,
    p95BudgetMs: 300,
  },
  {
    name: "ai.tasks.backlog",
    method: "GET",
    path: "/api/ai-tasks",
    validate: (result) => {
      const counts = countTaskStatuses(result.data);
      if (result.data.length !== 500) {
        throw new Error(`Expected 500 backlog tasks, received ${result.data.length}.`);
      }
      if (counts.queued !== 350 || counts.running !== 100 || counts.completed !== 50) {
        throw new Error(`Unexpected backlog status counts: ${JSON.stringify(counts)}.`);
      }
    },
    samples: 12,
    p95BudgetMs: 500,
  },
  {
    name: "ai.task.detail",
    method: "GET",
    path: () => `/api/ai-tasks/${state.aiTaskId}`,
    validate: (result) => {
      if (result.data.id !== state.aiTaskId || result.data.status !== "queued") {
        throw new Error("AI task detail did not return the expected queued task.");
      }
    },
    samples: 12,
    p95BudgetMs: 200,
  },
  {
    name: "report.generate",
    method: "POST",
    path: () => `/api/projects/${state.projectId}/reports`,
    body: (index) => ({
      type: reportTypes[index % reportTypes.length],
      format: "json",
    }),
    samples: 12,
    p95BudgetMs: 350,
  },
  {
    name: "export.keywords.csv",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/export/keywords.csv`,
    responseType: "text",
    validate: (result) => {
      if (!result.text.startsWith("phrase,searchVolume,cpc,kd,intent,source,finalScore")) {
        throw new Error("Keyword CSV export is missing the expected header.");
      }
      if (!result.text.includes("performance keyword 100")) {
        throw new Error("Keyword CSV export is missing seeded keyword data.");
      }
    },
    samples: 12,
    p95BudgetMs: 400,
  },
  {
    name: "export.project.json",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/export/project.json`,
    validate: (result) => {
      if (result.data?.keywords?.length !== 100) {
        throw new Error("Project JSON export did not include all seeded keywords.");
      }
      if ((result.data?.reports?.length ?? 0) < 12) {
        throw new Error("Project JSON export did not include generated reports.");
      }
    },
    samples: 12,
    p95BudgetMs: 500,
  },
];

const concurrentBudgets = [
  {
    name: "healthz.concurrent",
    method: "GET",
    path: "/api/healthz",
    totalRequests: 60,
    concurrency: 10,
    p95BudgetMs: 150,
  },
  {
    name: "dashboard.concurrent",
    method: "GET",
    path: "/api/tenant/dashboard",
    totalRequests: 50,
    concurrency: 10,
    p95BudgetMs: 500,
  },
  {
    name: "keywords.concurrent",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/keywords`,
    totalRequests: 50,
    concurrency: 10,
    p95BudgetMs: 600,
  },
  {
    name: "export.project.concurrent",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/export/project.json`,
    validate: (result) => {
      if (result.data?.project?.id !== state.projectId) {
        throw new Error("Concurrent project export returned the wrong project.");
      }
    },
    totalRequests: 30,
    concurrency: 5,
    p95BudgetMs: 900,
  },
  {
    name: "ai.tasks.concurrent",
    method: "GET",
    path: "/api/ai-tasks",
    validate: (result) => {
      if (result.data.length !== 500) {
        throw new Error(`Concurrent backlog read returned ${result.data.length} tasks.`);
      }
    },
    totalRequests: 30,
    concurrency: 5,
    p95BudgetMs: 900,
  },
];

const state = {
  aiTaskId: 0,
  cookie: "",
  clientId: 0,
  projectId: 0,
  tenantId: 0,
  userId: 0,
};

function quoteWindowsArg(value) {
  return /\s/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function spawnTarget(command, args) {
  if (process.platform !== "win32" || !["corepack", "pnpm", "npm", "npx"].includes(command)) {
    return { command, args };
  }

  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].map(quoteWindowsArg).join(" ")],
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const target = spawnTarget(command, args);
    const child = spawn(target.command, target.args, {
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? "inherit",
    });

    let stdout = "";
    let stderr = "";
    if (options.stdio === "pipe") {
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }

      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${code}${
            output ? `\n${output}` : ""
          }`,
        ),
      );
    });
  });
}

function startManagedProcess(name, command, args, env) {
  const target = spawnTarget(command, args);
  const child = spawn(target.command, target.args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs = [];
  const capture = (stream) => {
    stream?.on("data", (chunk) => {
      logs.push(
        ...chunk
          .toString()
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => `[${name}] ${line}`),
      );
      if (logs.length > 80) logs.splice(0, logs.length - 80);
    });
  };

  capture(child.stdout);
  capture(child.stderr);
  managedProcesses.push({ child, logs, name });
  return { child, logs, name };
}

function killProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  child.kill("SIGTERM");
  setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 5000).unref();
}

async function stopManagedProcesses() {
  await Promise.all(
    managedProcesses.map(
      ({ child }) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) {
            resolve();
            return;
          }
          child.once("exit", resolve);
          killProcessTree(child);
          setTimeout(resolve, 6000).unref();
        }),
    ),
  );
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Unable to allocate a local test port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await run(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", "rankmap_perf_baseline"],
      { allowFailure: true, stdio: "pipe" },
    );

    if (result.code === 0) return;
    await delay(1000);
  }

  throw new Error("Timed out waiting for the performance baseline Postgres container.");
}

async function waitForHttp(url, label, processRef) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processRef.child.exitCode !== null) {
      throw new Error(`${label} exited before it became ready.\n${processRef.logs.join("\n")}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The service is still starting.
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}.\n${processRef.logs.join("\n")}`);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (state.cookie) headers.set("cookie", state.cookie);

  const started = performance.now();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const durationMs = performance.now() - started;

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    state.cookie = setCookie.split(";")[0];
  }

  const text = await response.text();
  const data = options.responseType === "text" ? null : text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${text}`);
  }

  return { data, durationMs, text };
}

async function rawRequest(baseUrl, path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (path === "/api/healthz/detailed" && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${healthCheckToken}`);
  }

  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const durationMs = performance.now() - started;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data, durationMs };
}

async function seedData() {
  const unique = Date.now();
  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: `perf-${unique}@rankmap.test`,
      password: "PerfBaseline!234",
      fullName: "Performance Baseline Owner",
      tenantName: `Performance Tenant ${unique}`,
    },
  });
  state.tenantId = registration.data.user.tenantId;
  state.userId = registration.data.user.id;

  const client = await request("/api/clients", {
    method: "POST",
    body: {
      name: "Performance Baseline Client",
      domain: "perf-baseline.example.com",
      industry: "Software",
    },
  });
  state.clientId = client.data.id;

  const project = await request("/api/projects", {
    method: "POST",
    body: {
      clientId: state.clientId,
      name: "Performance Baseline Project",
      targetDomain: "perf-baseline.example.com",
      locale: "en-US",
    },
  });
  state.projectId = project.data.id;

  const keywords = Array.from({ length: 100 }, (_, index) => ({
    phrase: `performance keyword ${index + 1}`,
    searchVolume: 1000 + index,
    kd: 20 + (index % 50),
    cpc: 1 + index / 100,
    intent: ["informational", "commercial", "transactional", "navigational"][index % 4],
  }));

  const importResult = await request(`/api/projects/${state.projectId}/keywords/import`, {
    method: "POST",
    body: { source: "manual", keywords },
  });

  return {
    importedKeywords: importResult.data.imported,
    keywordImportMs: Math.round(importResult.durationMs),
  };
}

async function seedAiTaskBacklog() {
  const started = performance.now();
  const sql = `
    insert into ai_tasks (project_id, tenant_id, task_type, provider, status, input, output, created_by)
    select
      ${state.projectId},
      ${state.tenantId},
      case when gs % 3 = 0 then 'brief' when gs % 3 = 1 then 'cluster' else 'report' end,
      'mock',
      case when gs <= 350 then 'queued' when gs <= 450 then 'running' else 'completed' end,
      jsonb_build_object('backlogIndex', gs, 'keywordCount', 100),
      case when gs > 450 then jsonb_build_object('mock', true, 'taskId', gs) else null end,
      ${state.userId}
    from generate_series(1, 500) as gs;
  `;

  await run(
    "docker",
    [
      "exec",
      containerName,
      "psql",
      "-U",
      "rankmap",
      "-d",
      "rankmap_perf_baseline",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { stdio: "pipe" },
  );

  const tasks = await request("/api/ai-tasks");
  const queued = tasks.data.find((task) => task.status === "queued");
  if (!queued) {
    throw new Error("Unable to find a queued AI task after backlog seed.");
  }
  state.aiTaskId = queued.id;

  const counts = countTaskStatuses(tasks.data);
  if (tasks.data.length !== 500 || counts.queued !== 350 || counts.running !== 100) {
    throw new Error(`AI task backlog seed verification failed: ${JSON.stringify(counts)}.`);
  }

  return {
    tasks: tasks.data.length,
    queued: counts.queued,
    running: counts.running,
    completed: counts.completed,
    seedMs: Math.round(performance.now() - started),
  };
}

function countTaskStatuses(tasks) {
  return tasks.reduce(
    (counts, task) => {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
      return counts;
    },
    { queued: 0, running: 0, completed: 0 },
  );
}

function percentile(values, pct) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function summarize(values) {
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    min: Math.round(Math.min(...values)),
    p50: Math.round(percentile(values, 50)),
    p95: Math.round(percentile(values, 95)),
    max: Math.round(Math.max(...values)),
    avg: Math.round(avg),
  };
}

async function measureBudget(budget) {
  const durations = [];
  const path = typeof budget.path === "function" ? budget.path() : budget.path;

  for (let index = 0; index < budget.samples; index += 1) {
    const body = typeof budget.body === "function" ? budget.body(index) : budget.body;
    const result = await request(path, {
      body,
      method: budget.method,
      responseType: budget.responseType,
    });
    budget.validate?.(result);
    durations.push(result.durationMs);
  }

  const summary = summarize(durations);
  return {
    ...budget,
    path,
    ...summary,
    passed: summary.p95 <= budget.p95BudgetMs,
  };
}

async function measureConcurrentBudget(budget) {
  const path = typeof budget.path === "function" ? budget.path() : budget.path;
  const durations = [];
  let failures = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < budget.totalRequests) {
      nextIndex += 1;
      try {
        const result = await request(path, {
          method: budget.method,
          responseType: budget.responseType,
        });
        budget.validate?.(result);
        durations.push(result.durationMs);
      } catch {
        failures += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: budget.concurrency }, () => worker()));
  const summary = summarize(durations.length > 0 ? durations : [Number.POSITIVE_INFINITY]);

  return {
    ...budget,
    path,
    ...summary,
    failures,
    passed: failures === 0 && summary.p95 <= budget.p95BudgetMs,
  };
}

async function checkDegradedHealth() {
  const apiProcess = startManagedProcess(
    "api-degraded",
    "corepack",
    ["pnpm", "--filter", "@workspace/api-server", "run", "start"],
    {
      DATABASE_URL: databaseUrl,
      FEATURE_BILLING: "true",
      FEATURE_STRIPE_BILLING: "true",
      NODE_ENV: "test",
      PORT: degradedApiPort,
      HEALTH_CHECK_TOKEN: healthCheckToken,
      SESSION_SECRET: "performance-degraded-session-secret-with-at-least-32-characters",
    },
  );

  await waitForHttp(`${degradedApiUrl}/api/healthz`, "degraded API server", apiProcess);

  const { response, data, durationMs } = await rawRequest(degradedApiUrl, "/api/healthz/detailed");
  const missing = data?.services?.billing?.missing ?? [];
  const passed =
    response.status === 503 &&
    data?.status === "degraded" &&
    data?.services?.database?.status === "ok" &&
    data?.services?.billing?.status === "missing-config" &&
    missing.includes("STRIPE_SECRET_KEY") &&
    missing.includes("STRIPE_WEBHOOK_SECRET");

  return {
    name: "health.degraded.billing",
    status: response.status,
    durationMs: Math.round(durationMs),
    missing,
    passed,
  };
}

async function checkDatabaseOutageHealth() {
  await run("docker", ["stop", containerName], { allowFailure: true, stdio: "pipe" });

  const { response, data, durationMs } = await rawRequest(apiUrl, "/api/healthz/detailed");
  const passed =
    response.status === 503 &&
    data?.status === "degraded" &&
    data?.services?.database?.status === "error";

  return {
    name: "health.degraded.database",
    status: response.status,
    durationMs: Math.round(durationMs),
    databaseStatus: data?.services?.database?.status,
    passed,
  };
}

function printResults(
  seed,
  backlogSeed,
  results,
  concurrentResults,
  degradedHealth,
  databaseOutageHealth,
) {
  console.log("\nPerformance baseline");
  console.log(`Seeded ${seed.importedKeywords} keywords in ${seed.keywordImportMs}ms`);
  console.log(
    `Seeded ${backlogSeed.tasks} AI tasks in ${backlogSeed.seedMs}ms (${backlogSeed.queued} queued, ${backlogSeed.running} running, ${backlogSeed.completed} completed)`,
  );
  console.log(
    "Endpoint".padEnd(22) +
      "p50".padStart(8) +
      "p95".padStart(8) +
      "max".padStart(8) +
      "budget".padStart(10) +
      "status".padStart(10),
  );

  for (const result of results) {
    console.log(
      result.name.padEnd(22) +
        `${result.p50}ms`.padStart(8) +
        `${result.p95}ms`.padStart(8) +
        `${result.max}ms`.padStart(8) +
        `${result.p95BudgetMs}ms`.padStart(10) +
        (result.passed ? "PASS" : "FAIL").padStart(10),
    );
  }

  console.log("\nConcurrent baseline");
  console.log(
    "Endpoint".padEnd(24) +
      "p50".padStart(8) +
      "p95".padStart(8) +
      "max".padStart(8) +
      "budget".padStart(10) +
      "fails".padStart(8) +
      "status".padStart(10),
  );

  for (const result of concurrentResults) {
    console.log(
      result.name.padEnd(24) +
        `${result.p50}ms`.padStart(8) +
        `${result.p95}ms`.padStart(8) +
        `${result.max}ms`.padStart(8) +
        `${result.p95BudgetMs}ms`.padStart(10) +
        String(result.failures).padStart(8) +
        (result.passed ? "PASS" : "FAIL").padStart(10),
    );
  }

  console.log("\nFailure-mode baseline");
  for (const result of [degradedHealth, databaseOutageHealth]) {
    console.log(
      `${result.name}: status ${result.status}, ${result.durationMs}ms, ${
        result.passed ? "PASS" : "FAIL"
      }`,
    );
  }
}

try {
  await run("docker", [
    "run",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=rankmap",
    "-e",
    "POSTGRES_PASSWORD=rankmap",
    "-e",
    "POSTGRES_DB=rankmap_perf_baseline",
    "-p",
    `127.0.0.1:${postgresPort}:5432`,
    "-d",
    "postgres:16-alpine",
  ]);

  await waitForPostgres();

  await run("corepack", ["pnpm", "--filter", "@workspace/db", "run", "migrate"], {
    env: { DATABASE_URL: databaseUrl },
  });
  await run("corepack", ["pnpm", "--filter", "@workspace/api-server", "run", "build"]);

  const apiProcess = startManagedProcess(
    "api",
    "corepack",
    ["pnpm", "--filter", "@workspace/api-server", "run", "start"],
    {
      DATABASE_URL: databaseUrl,
      FEATURE_BILLING: "false",
      FEATURE_STRIPE_BILLING: "false",
      NODE_ENV: "test",
      PORT: apiPort,
      HEALTH_CHECK_TOKEN: healthCheckToken,
      SESSION_SECRET: "performance-baseline-session-secret-with-at-least-32-characters",
    },
  );

  await waitForHttp(`${apiUrl}/api/healthz`, "API server", apiProcess);

  const seed = await seedData();
  const backlogSeed = await seedAiTaskBacklog();
  const results = [];
  for (const budget of budgets) {
    results.push(await measureBudget(budget));
  }

  const concurrentResults = [];
  for (const budget of concurrentBudgets) {
    concurrentResults.push(await measureConcurrentBudget(budget));
  }

  const degradedHealth = await checkDegradedHealth();
  const databaseOutageHealth = await checkDatabaseOutageHealth();
  printResults(seed, backlogSeed, results, concurrentResults, degradedHealth, databaseOutageHealth);

  const failures = [
    ...results.filter((result) => !result.passed),
    ...concurrentResults.filter((result) => !result.passed),
  ];
  if (!degradedHealth.passed) {
    failures.push({
      name: degradedHealth.name,
      p95: degradedHealth.durationMs,
      p95BudgetMs: "expected degraded 503",
    });
  }
  if (!databaseOutageHealth.passed) {
    failures.push({
      name: databaseOutageHealth.name,
      p95: databaseOutageHealth.durationMs,
      p95BudgetMs: "expected database degraded 503",
    });
  }
  if (seed.importedKeywords !== 100) {
    failures.push({ name: "keyword import", p95: seed.keywordImportMs, p95BudgetMs: 5000 });
  }
  if (seed.keywordImportMs > 5000) {
    failures.push({
      name: "keyword import duration",
      p95: seed.keywordImportMs,
      p95BudgetMs: 5000,
    });
  }
  if (backlogSeed.tasks !== 500 || backlogSeed.seedMs > 5000) {
    failures.push({
      name: "ai task backlog seed",
      p95: backlogSeed.seedMs,
      p95BudgetMs: 5000,
    });
  }

  if (failures.length > 0) {
    throw new Error(
      `Performance baseline failed: ${failures
        .map((failure) => `${failure.name} p95=${failure.p95}ms budget=${failure.p95BudgetMs}ms`)
        .join("; ")}`,
    );
  }
} finally {
  await stopManagedProcesses();
  await run("docker", ["rm", "-f", containerName], { allowFailure: true });
}
