import { createServer } from "node:http";
import { spawn } from "node:child_process";
import net from "node:net";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

const containerName = `rankmap-slow-provider-${Date.now()}`;
const postgresPort = String(await getFreePort());
const apiPort = String(await getFreePort());
const providerPort = String(await getFreePort());
const databaseUrl = `postgresql://rankmap:rankmap@localhost:${postgresPort}/rankmap_slow_provider`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const providerUrl = `http://127.0.0.1:${providerPort}/v1`;
const managedProcesses = [];
let slowProviderServer;

const state = {
  cookie: "",
  clientId: 0,
  projectId: 0,
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
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", "rankmap_slow_provider"],
      { allowFailure: true, stdio: "pipe" },
    );

    if (result.code === 0) return;
    await delay(1000);
  }

  throw new Error("Timed out waiting for the slow-provider Postgres container.");
}

async function waitForHttp(url, label, processRef) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processRef?.child.exitCode !== null) {
      throw new Error(`${label} exited before it became ready.\n${processRef.logs.join("\n")}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Service still starting.
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}.`);
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
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${text}`);
  }

  return { data, durationMs };
}

async function startSlowProvider() {
  slowProviderServer = createServer(async (req, res) => {
    if (req.url === "/v1/chat/completions") {
      await delay(1500);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: '{"clusters":[]}' } }] }));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise((resolve) =>
    slowProviderServer.listen(Number(providerPort), "127.0.0.1", resolve),
  );
}

async function stopSlowProvider() {
  if (!slowProviderServer) return;
  await new Promise((resolve) => slowProviderServer.close(resolve));
}

async function seedData() {
  const unique = Date.now();
  await request("/api/auth/register", {
    method: "POST",
    body: {
      email: `slow-provider-${unique}@rankmap.test`,
      password: "SlowProvider!234",
      fullName: "Slow Provider Owner",
      tenantName: `Slow Provider Tenant ${unique}`,
    },
  });

  const client = await request("/api/clients", {
    method: "POST",
    body: {
      name: "Slow Provider Client",
      domain: "slow-provider.example.com",
      industry: "Software",
    },
  });
  state.clientId = client.data.id;

  const project = await request("/api/projects", {
    method: "POST",
    body: {
      clientId: state.clientId,
      name: "Slow Provider Project",
      targetDomain: "slow-provider.example.com",
      locale: "en-US",
    },
  });
  state.projectId = project.data.id;

  const keywords = Array.from({ length: 20 }, (_, index) => ({
    phrase: `slow provider keyword ${index + 1}`,
    searchVolume: 1000 + index,
    kd: 20 + index,
    cpc: 1 + index / 100,
    intent: ["informational", "commercial", "transactional", "navigational"][index % 4],
  }));

  await request(`/api/projects/${state.projectId}/keywords/import`, {
    method: "POST",
    body: { source: "manual", keywords },
  });
}

try {
  await startSlowProvider();

  await run("docker", [
    "run",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=rankmap",
    "-e",
    "POSTGRES_PASSWORD=rankmap",
    "-e",
    "POSTGRES_DB=rankmap_slow_provider",
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
      OPENAI_API_KEY: "slow-provider-baseline-key",
      OPENAI_BASE_URL: providerUrl,
      OPENAI_TIMEOUT_MS: "200",
      PORT: apiPort,
      SESSION_SECRET: "slow-provider-session-secret-with-at-least-32-characters",
    },
  );

  await waitForHttp(`${apiUrl}/api/healthz`, "API server", apiProcess);
  await seedData();

  const { data, durationMs } = await request(`/api/projects/${state.projectId}/clusters/auto`, {
    method: "POST",
  });
  const clusterDurationMs = Math.round(durationMs);

  if (!Array.isArray(data.clusters) || data.clusters.length === 0) {
    throw new Error("Slow-provider fallback did not create mock clusters.");
  }
  if (!data.taskId) {
    throw new Error("Slow-provider fallback did not enqueue an AI task.");
  }
  if (clusterDurationMs > 2500) {
    throw new Error(`Slow-provider fallback took ${clusterDurationMs}ms, expected <= 2500ms.`);
  }

  const task = await request(`/api/ai-tasks/${data.taskId}`);
  if (task.data.input?.provider !== "openai") {
    throw new Error("Slow-provider task did not record the attempted OpenAI provider.");
  }

  console.log("\nSlow-provider baseline");
  console.log(`Slow OpenAI-compatible endpoint delayed for 1500ms`);
  console.log(`API timeout configured at 200ms`);
  console.log(
    `Auto-clustering fell back to mock in ${clusterDurationMs}ms and created ${data.clusters.length} clusters`,
  );
} finally {
  await stopSlowProvider();
  await stopManagedProcesses();
  await run("docker", ["rm", "-f", containerName], { allowFailure: true, stdio: "pipe" });
}
