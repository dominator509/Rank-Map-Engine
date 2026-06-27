import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
export const OPENAPI_PATH = resolve(ROOT, "lib/api-spec/openapi.yaml");
export const OUT_DIR = resolve(ROOT, "artifacts/blackbox");

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const env = { ...process.env, ...(options.env ?? {}) };
    if (
      process.platform === "win32" &&
      command === "docker" &&
      !env.DOCKER_CONTEXT &&
      !env.DOCKER_HOST
    ) {
      env.DOCKER_HOST = "npipe:////./pipe/dockerDesktopLinuxEngine";
    }
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      stdio: options.stdio ?? "pipe",
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolvePromise({ code, stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${stderr}`));
      }
    });
  });
}

export async function getFreePort() {
  return await new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") reject(new Error("port alloc failed"));
        else resolvePromise(address.port);
      });
    });
  });
}

async function waitForPostgres(containerName) {
  for (let i = 0; i < 30; i += 1) {
    const res = await run(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", "rankmap_test"],
      { allowFailure: true },
    );
    if (res.code === 0) return;
    await delay(1000);
  }
  throw new Error("postgres readiness timeout");
}

async function ensureDockerAvailable() {
  const result = await run("docker", ["info"], { allowFailure: true });
  if (result.code === 0) return;

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  throw new Error(
    [
      "Docker is required for blackbox phases 2-5 because they start a disposable Postgres container.",
      "Start Docker Desktop or make the Docker daemon reachable, then rerun `node scripts/blackbox/run-phase.mjs <2|3|4|5>`.",
      output,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function waitForHttp(url, getLogs) {
  for (let i = 0; i < 45; i += 1) {
    try {
      const res = await fetch(`${url}/api/healthz`);
      if (res.ok) return;
    } catch {
      // Keep polling until the API starts accepting health checks.
    }
    await delay(500);
  }
  throw new Error(`api readiness timeout\n${getLogs()}`);
}

export async function startSystem() {
  await ensureDockerAvailable();

  const dbPort = String(await getFreePort());
  const apiPort = String(await getFreePort());
  const containerName = `rankmap-blackbox-${Date.now()}`;
  const DATABASE_URL = `postgresql://rankmap:rankmap@127.0.0.1:${dbPort}/rankmap_test`;

  await run("docker", [
    "run",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=rankmap",
    "-e",
    "POSTGRES_PASSWORD=rankmap",
    "-e",
    "POSTGRES_DB=rankmap_test",
    "-p",
    `127.0.0.1:${dbPort}:5432`,
    "-d",
    "postgres:16-alpine",
  ]);
  await waitForPostgres(containerName);

  await run("cmd.exe", ["/d", "/s", "/c", "corepack pnpm --filter @workspace/db run migrate"], {
    env: { DATABASE_URL },
  });

  const server = spawn("node", ["artifacts/api-server/dist/index.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL,
      NODE_ENV: "test",
      SESSION_SECRET: "blackbox-session-secret-with-at-least-32-characters",
      PORT: apiPort,
    },
    stdio: "pipe",
  });
  let serverLogs = "";
  server.stdout?.on("data", (chunk) => (serverLogs += chunk.toString()));
  server.stderr?.on("data", (chunk) => (serverLogs += chunk.toString()));

  const baseUrl = `http://127.0.0.1:${apiPort}`;
  await waitForHttp(baseUrl, () => serverLogs.slice(-4000));

  return {
    baseUrl,
    async stop() {
      server.kill("SIGTERM");
      await run("docker", ["rm", "-f", containerName], { allowFailure: true });
    },
  };
}

export async function readOpenApiText() {
  return await readFile(OPENAPI_PATH, "utf8");
}

export async function writeOut(relPath, data) {
  const outputPath = resolve(OUT_DIR, relPath);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, data, "utf8");
  return outputPath;
}

export function summarizePaths(openapiText) {
  const lines = openapiText.split(/\r?\n/);
  const items = [];
  let currentPath = "";
  let currentMethod = "";
  let operationId = "";
  let auth = "session-cookie (inferred)";

  for (const line of lines) {
    const p = /^\s{2}(\/[\w/{}-]+):\s*$/.exec(line);
    if (p) {
      currentPath = p[1];
      continue;
    }
    const m = /^\s{4}(get|post|patch|delete):\s*$/.exec(line);
    if (m && currentPath) {
      currentMethod = m[1].toUpperCase();
      operationId = "";
      auth =
        currentPath.startsWith("/auth/register") ||
        currentPath.startsWith("/auth/login") ||
        currentPath.startsWith("/healthz")
          ? "none"
          : "session-cookie (inferred)";
      items.push({ path: currentPath, method: currentMethod, operationId, auth });
      continue;
    }
    const op = /^\s{6}operationId:\s*(\w+)/.exec(line);
    if (op && items.length) items[items.length - 1].operationId = op[1];
  }
  return items;
}

export function createClient(baseUrl) {
  const cookies = new Map();

  return {
    async request(path, options = {}) {
      const headers = { ...(options.headers ?? {}) };
      const cookie = Array.from(cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      if (cookie) headers.Cookie = cookie;

      const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const parts = setCookie.split(",");
        for (const part of parts) {
          const cookiePair = part.split(";")[0];
          const [name, value] = cookiePair.split("=");
          if (name && value) cookies.set(name.trim(), value.trim());
        }
      }

      let body = null;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: res.status, body, headers: Object.fromEntries(res.headers.entries()) };
    },
  };
}
