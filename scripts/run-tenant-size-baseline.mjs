import { spawn } from "node:child_process";
import net from "node:net";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

const containerName = `rankmap-tenant-size-${Date.now()}`;
const postgresPort = String(await getFreePort());
const apiPort = String(await getFreePort());
const databaseUrl = `postgresql://rankmap:rankmap@localhost:${postgresPort}/rankmap_tenant_size`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const managedProcesses = [];

const state = {
  cookie: "",
  tenantId: 0,
  userId: 0,
  clientId: 0,
  projectId: 0,
};

const budgets = [
  {
    name: "tenant.dashboard.large",
    method: "GET",
    path: "/api/tenant/dashboard",
    samples: 8,
    p95BudgetMs: 800,
    validate: (result) => {
      if (result.data.clientCount !== 25 || result.data.projectCount !== 100) {
        throw new Error("Large dashboard counts did not match seeded tenant size.");
      }
      if (result.data.keywordCount !== 9950 || result.data.aiTasksThisMonth !== 1000) {
        throw new Error("Large dashboard keyword/task counts did not match seeded tenant size.");
      }
    },
  },
  {
    name: "clients.list.large",
    method: "GET",
    path: "/api/clients",
    samples: 8,
    p95BudgetMs: 500,
    validate: (result) => {
      if (result.data.length !== 25) {
        throw new Error(`Expected 25 clients, received ${result.data.length}.`);
      }
    },
  },
  {
    name: "projects.list.large",
    method: "GET",
    path: () => `/api/projects?clientId=${state.clientId}`,
    samples: 8,
    p95BudgetMs: 500,
    validate: (result) => {
      if (result.data.length !== 4) {
        throw new Error(`Expected 4 projects for target client, received ${result.data.length}.`);
      }
    },
  },
  {
    name: "keywords.list.large",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/keywords`,
    samples: 8,
    p95BudgetMs: 1500,
    validate: (result) => {
      if (result.data.length !== 5000) {
        throw new Error(`Expected 5000 project keywords, received ${result.data.length}.`);
      }
    },
  },
  {
    name: "export.keywords.large",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/export/keywords.csv`,
    responseType: "text",
    samples: 6,
    p95BudgetMs: 2500,
    validate: (result) => {
      if (!result.text.includes("large tenant keyword 5000")) {
        throw new Error("Large CSV export did not include the final seeded keyword.");
      }
    },
  },
  {
    name: "export.project.large",
    method: "GET",
    path: () => `/api/projects/${state.projectId}/export/project.json`,
    samples: 6,
    p95BudgetMs: 3000,
    validate: (result) => {
      if (result.data?.keywords?.length !== 5000) {
        throw new Error("Large project export did not include all target project keywords.");
      }
      if (result.data?.reports?.length !== 20) {
        throw new Error("Large project export did not include all seeded reports.");
      }
    },
  },
  {
    name: "ai.tasks.large",
    method: "GET",
    path: "/api/ai-tasks",
    samples: 6,
    p95BudgetMs: 1500,
    validate: (result) => {
      if (result.data.length !== 1000) {
        throw new Error(`Expected 1000 AI tasks, received ${result.data.length}.`);
      }
    },
  },
];

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
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", "rankmap_tenant_size"],
      { allowFailure: true, stdio: "pipe" },
    );

    if (result.code === 0) return;
    await delay(1000);
  }

  throw new Error("Timed out waiting for the tenant-size Postgres container.");
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
      // Service still starting.
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
  if (setCookie) state.cookie = setCookie.split(";")[0];

  const text = await response.text();
  const data = options.responseType === "text" ? null : text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${text}`);
  }

  return { data, durationMs, text };
}

async function psql(sql) {
  await run(
    "docker",
    [
      "exec",
      containerName,
      "psql",
      "-U",
      "rankmap",
      "-d",
      "rankmap_tenant_size",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { stdio: "pipe" },
  );
}

async function seedTenant() {
  const unique = Date.now();
  const registration = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: `tenant-size-${unique}@rankmap.test`,
      password: "TenantSize!234",
      fullName: "Tenant Size Owner",
      tenantName: `Tenant Size ${unique}`,
    },
  });
  state.tenantId = registration.data.user.tenantId;
  state.userId = registration.data.user.id;

  const client = await request("/api/clients", {
    method: "POST",
    body: {
      name: "Large Tenant Client 1",
      domain: "large-tenant-1.example.com",
      industry: "Software",
    },
  });
  state.clientId = client.data.id;

  const project = await request("/api/projects", {
    method: "POST",
    body: {
      clientId: state.clientId,
      name: "Large Tenant Project 1",
      targetDomain: "large-tenant-1.example.com",
      locale: "en-US",
    },
  });
  state.projectId = project.data.id;
}

async function seedLargeDataset() {
  const started = performance.now();
  const sql = `
    insert into clients (tenant_id, name, domain, industry)
    select
      ${state.tenantId},
      'Large Tenant Client ' || gs,
      'large-tenant-' || gs || '.example.com',
      'Software'
    from generate_series(2, 25) as gs;

    insert into projects (tenant_id, client_id, name, target_domain, locale)
    select
      ${state.tenantId},
      c.id,
      'Large Tenant Project ' || c.client_number || '-' || project_number,
      'large-tenant-' || c.client_number || '.example.com',
      'en-US'
    from (
      select id, row_number() over (order by id) as client_number
      from clients
      where tenant_id = ${state.tenantId}
    ) c
    cross join generate_series(1, 4) as project_number
    where not (c.id = ${state.clientId} and project_number = 1);

    insert into project_score_settings (project_id)
    select p.id
    from projects p
    left join project_score_settings s on s.project_id = p.id
    where p.tenant_id = ${state.tenantId} and s.project_id is null;

    insert into keywords (project_id, tenant_id, phrase, search_volume, cpc, kd, intent, source, raw_score, final_score)
    select
      ${state.projectId},
      ${state.tenantId},
      'large tenant keyword ' || gs,
      10000 - gs,
      1 + (gs::real / 100),
      10 + (gs % 80),
      case when gs % 4 = 0 then 'informational' when gs % 4 = 1 then 'commercial' when gs % 4 = 2 then 'transactional' else 'navigational' end,
      'manual',
      40 + (gs % 60),
      40 + (gs % 60)
    from generate_series(1, 5000) as gs;

    insert into keywords (project_id, tenant_id, phrase, search_volume, cpc, kd, intent, source, raw_score, final_score)
    select
      p.id,
      ${state.tenantId},
      'supporting tenant keyword ' || p.id || '-' || gs,
      5000 - gs,
      1 + (gs::real / 100),
      20 + (gs % 60),
      case when gs % 4 = 0 then 'informational' when gs % 4 = 1 then 'commercial' when gs % 4 = 2 then 'transactional' else 'navigational' end,
      'manual',
      30 + (gs % 70),
      30 + (gs % 70)
    from projects p
    cross join generate_series(1, 50) as gs
    where p.tenant_id = ${state.tenantId} and p.id <> ${state.projectId};

    insert into reports (project_id, tenant_id, type, format, generated_at, data)
    select
      ${state.projectId},
      ${state.tenantId},
      case when gs % 3 = 0 then 'project_summary' when gs % 3 = 1 then 'topical_authority' else 'content_pipeline' end,
      'json',
      now(),
      jsonb_build_object('largeTenantReport', gs, 'keywordCount', 5000)
    from generate_series(1, 20) as gs;

    insert into ai_tasks (project_id, tenant_id, task_type, provider, status, input, output, created_by)
    select
      ${state.projectId},
      ${state.tenantId},
      case when gs % 3 = 0 then 'brief' when gs % 3 = 1 then 'cluster' else 'report' end,
      'mock',
      case when gs <= 700 then 'queued' when gs <= 900 then 'running' else 'completed' end,
      jsonb_build_object('largeTenantIndex', gs),
      case when gs > 900 then jsonb_build_object('mock', true, 'taskId', gs) else null end,
      ${state.userId}
    from generate_series(1, 1000) as gs;
  `;

  await psql(sql);
  return Math.round(performance.now() - started);
}

function percentile(values, pct) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function summarize(values) {
  return {
    p50: Math.round(percentile(values, 50)),
    p95: Math.round(percentile(values, 95)),
    max: Math.round(Math.max(...values)),
  };
}

async function measureBudget(budget) {
  const path = typeof budget.path === "function" ? budget.path() : budget.path;
  const durations = [];
  for (let index = 0; index < budget.samples; index += 1) {
    const result = await request(path, {
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

function printResults(seedMs, results) {
  console.log("\nTenant-size baseline");
  console.log("Seeded 25 clients, 100 projects, 9950 keywords, 1000 AI tasks, and 20 reports");
  console.log(`Large dataset seed completed in ${seedMs}ms`);
  console.log(
    "Endpoint".padEnd(24) +
      "p50".padStart(8) +
      "p95".padStart(8) +
      "max".padStart(8) +
      "budget".padStart(10) +
      "status".padStart(10),
  );
  for (const result of results) {
    console.log(
      result.name.padEnd(24) +
        `${result.p50}ms`.padStart(8) +
        `${result.p95}ms`.padStart(8) +
        `${result.max}ms`.padStart(8) +
        `${result.p95BudgetMs}ms`.padStart(10) +
        (result.passed ? "PASS" : "FAIL").padStart(10),
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
    "POSTGRES_DB=rankmap_tenant_size",
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
      SESSION_SECRET: "tenant-size-session-secret-with-at-least-32-characters",
    },
  );

  await waitForHttp(`${apiUrl}/api/healthz`, "API server", apiProcess);
  await seedTenant();
  const seedMs = await seedLargeDataset();

  const results = [];
  for (const budget of budgets) {
    results.push(await measureBudget(budget));
  }

  printResults(seedMs, results);

  const failures = results.filter((result) => !result.passed);
  if (seedMs > 15_000) {
    failures.push({ name: "large dataset seed", p95: seedMs, p95BudgetMs: 15_000 });
  }

  if (failures.length > 0) {
    throw new Error(
      `Tenant-size baseline failed: ${failures
        .map((failure) => `${failure.name} p95=${failure.p95}ms budget=${failure.p95BudgetMs}ms`)
        .join("; ")}`,
    );
  }
} finally {
  await stopManagedProcesses();
  await run("docker", ["rm", "-f", containerName], { allowFailure: true, stdio: "pipe" });
}
