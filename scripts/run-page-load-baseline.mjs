import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repoRoot, "artifacts", "rankmap", "dist", "public");
const containerName = `rankmap-page-load-${Date.now()}`;
const postgresPort = String(await getFreePort());
const apiPort = String(await getFreePort());
const webPort = String(await getFreePort());
const databaseUrl = `postgresql://rankmap:rankmap@localhost:${postgresPort}/rankmap_page_load`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const managedProcesses = [];
let webServer;

const state = {
  cookie: "",
  clientId: 0,
  projectId: 0,
};

const pageBudgets = [
  {
    name: "login",
    path: "/login",
    selector: 'main:has-text("Welcome back")',
    budgetMs: 1800,
  },
  {
    name: "dashboard",
    path: "/dashboard",
    selector: 'main:has-text("Dashboard")',
    budgetMs: 2500,
  },
  {
    name: "clients",
    path: "/clients",
    selector: 'main:has-text("Page Load Client")',
    budgetMs: 2500,
  },
  {
    name: "client.detail",
    path: () => `/clients/${state.clientId}`,
    selector: 'main:has-text("Page Load Project")',
    budgetMs: 2500,
  },
  {
    name: "project.detail",
    path: () => `/clients/${state.clientId}/projects/${state.projectId}`,
    selector: 'main:has-text("page load keyword 100")',
    budgetMs: 3000,
  },
  {
    name: "analytics",
    path: "/analytics",
    selector: 'main:has-text("Analytics")',
    budgetMs: 3000,
  },
  {
    name: "billing",
    path: "/billing",
    selector: 'main:has-text("Current Plan")',
    budgetMs: 2500,
  },
  {
    name: "settings",
    path: "/settings",
    selector: 'main:has-text("Workspace Name")',
    budgetMs: 2500,
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
      cwd: repoRoot,
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
    cwd: repoRoot,
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
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", "rankmap_page_load"],
      { allowFailure: true, stdio: "pipe" },
    );

    if (result.code === 0) return;
    await delay(1000);
  }

  throw new Error("Timed out waiting for the page-load Postgres container.");
}

async function waitForHttp(url, label, processRef) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processRef && processRef.child.exitCode !== null) {
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

  throw new Error(`Timed out waiting for ${label} at ${url}.`);
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (state.cookie) headers.set("cookie", state.cookie);

  const response = await fetch(`${apiUrl}${pathname}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) state.cookie = setCookie.split(";")[0];

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${pathname} returned ${response.status}: ${text}`);
  }
  return data;
}

async function seedData() {
  const unique = Date.now();
  const email = `page-load-${unique}@rankmap.test`;
  const password = "PageLoad!234";

  await request("/api/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      fullName: "Page Load Owner",
      tenantName: `Page Load Tenant ${unique}`,
    },
  });

  const client = await request("/api/clients", {
    method: "POST",
    body: {
      name: "Page Load Client",
      domain: "page-load.example.com",
      industry: "Software",
    },
  });
  state.clientId = client.id;

  const project = await request("/api/projects", {
    method: "POST",
    body: {
      clientId: state.clientId,
      name: "Page Load Project",
      targetDomain: "page-load.example.com",
      locale: "en-US",
    },
  });
  state.projectId = project.id;

  const keywords = Array.from({ length: 100 }, (_, index) => ({
    phrase: `page load keyword ${index + 1}`,
    searchVolume: 500 + index,
    kd: 10 + (index % 60),
    cpc: 1 + index / 100,
    intent: ["informational", "commercial", "transactional", "navigational"][index % 4],
  }));

  await request(`/api/projects/${state.projectId}/keywords/import`, {
    method: "POST",
    body: { source: "manual", keywords },
  });

  return { email, password };
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

async function proxyApiRequest(req, res) {
  const target = new URL(req.url ?? "/", apiUrl);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(","));
    } else {
      headers.set(key, value);
    }
  }
  headers.set("host", new URL(apiUrl).host);

  const response = await fetch(target, {
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
    duplex: "half",
    headers,
    method: req.method,
  });

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

async function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", webUrl);
  const decodedPath = decodeURIComponent(url.pathname);
  const safePath = path
    .normalize(decodedPath)
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const requestedPath = path.join(webRoot, safePath);

  let filePath = requestedPath;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    filePath = path.join(webRoot, "index.html");
  }

  res.setHeader("content-type", getContentType(filePath));
  createReadStream(filePath).pipe(res);
}

function startWebServer() {
  webServer = createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/api/")) {
        await proxyApiRequest(req, res);
        return;
      }
      await serveStatic(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.message : "Internal server error");
    }
  });

  return new Promise((resolve) => {
    webServer.listen(Number(webPort), "127.0.0.1", resolve);
  });
}

async function stopWebServer() {
  if (!webServer) return;
  await new Promise((resolve) => webServer.close(resolve));
}

async function signIn(page, email, password) {
  await page.goto(`${webUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.locator('main:has-text("Dashboard")').waitFor({ state: "visible" });
}

async function measurePage(page, budget) {
  const pathname = typeof budget.path === "function" ? budget.path() : budget.path;
  const started = performance.now();
  await page.goto(`${webUrl}${pathname}`, { waitUntil: "domcontentloaded" });
  await page.locator(budget.selector).waitFor({ state: "visible", timeout: budget.budgetMs });
  await page.waitForLoadState("networkidle", { timeout: budget.budgetMs }).catch(() => {});
  const durationMs = Math.round(performance.now() - started);
  const bodyText = await page.locator("body").innerText();
  const passed = durationMs <= budget.budgetMs && bodyText.trim().length > 40;

  return {
    ...budget,
    path: pathname,
    durationMs,
    passed,
  };
}

function printResults(results, mobileResult) {
  console.log("\nPage-load baseline");
  console.log(
    "Page".padEnd(20) + "duration".padStart(12) + "budget".padStart(10) + "status".padStart(10),
  );
  for (const result of [...results, mobileResult]) {
    console.log(
      result.name.padEnd(20) +
        `${result.durationMs}ms`.padStart(12) +
        `${result.budgetMs}ms`.padStart(10) +
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
    "POSTGRES_DB=rankmap_page_load",
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
  await run("corepack", ["pnpm", "--filter", "@workspace/rankmap", "run", "build"], {
    env: {
      API_SERVER_URL: apiUrl,
      BASE_PATH: "/",
      NODE_ENV: "production",
      PORT: webPort,
    },
  });

  const apiProcess = startManagedProcess(
    "api",
    "corepack",
    ["pnpm", "--filter", "@workspace/api-server", "run", "start"],
    {
      ALLOWED_ORIGINS: webUrl,
      DATABASE_URL: databaseUrl,
      FEATURE_BILLING: "false",
      FEATURE_STRIPE_BILLING: "false",
      NODE_ENV: "test",
      PORT: apiPort,
      SESSION_SECRET: "page-load-session-secret-with-at-least-32-characters",
    },
  );
  await waitForHttp(`${apiUrl}/api/healthz`, "API server", apiProcess);

  const credentials = await seedData();
  await startWebServer();
  await waitForHttp(webUrl, "page-load frontend");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await measurePage(page, pageBudgets[0]);
  await signIn(page, credentials.email, credentials.password);

  const results = [];
  for (const budget of pageBudgets) {
    if (budget.name === "login") continue;
    results.push(await measurePage(page, budget));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileResult = await measurePage(page, {
    name: "mobile.dashboard",
    path: "/dashboard",
    selector: 'main:has-text("Dashboard")',
    budgetMs: 3000,
  });

  await browser.close();

  const loginResult = await (async () => {
    const loginPage = await chromium.launch().then(async (loginBrowser) => {
      const login = await loginBrowser.newPage({ viewport: { width: 1440, height: 1000 } });
      const result = await measurePage(login, pageBudgets[0]);
      await loginBrowser.close();
      return result;
    });
    return loginPage;
  })();

  const allResults = [loginResult, ...results];
  printResults(allResults, mobileResult);

  const failures = [...allResults, mobileResult].filter((result) => !result.passed);
  if (errors.length > 0) {
    failures.push({
      name: "browser console errors",
      durationMs: errors.length,
      budgetMs: 0,
      passed: false,
    });
  }

  if (failures.length > 0) {
    throw new Error(
      `Page-load baseline failed: ${failures
        .map((failure) => `${failure.name} ${failure.durationMs}ms budget=${failure.budgetMs}ms`)
        .join("; ")}${errors.length > 0 ? `\nConsole errors:\n${errors.join("\n")}` : ""}`,
    );
  }
} finally {
  await stopWebServer();
  await stopManagedProcesses();
  await run("docker", ["rm", "-f", containerName], { allowFailure: true });
}
