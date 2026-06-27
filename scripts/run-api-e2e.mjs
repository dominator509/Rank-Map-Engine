import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const containerName = `rankmap-api-e2e-${Date.now()}`;
const port = String(await getFreePort());
const databaseUrl = `postgresql://rankmap:rankmap@localhost:${port}/rankmap_test`;

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
    const env = { ...process.env, ...(options.env ?? {}) };
    if (
      process.platform === "win32" &&
      command === "docker" &&
      !env.DOCKER_CONTEXT &&
      !env.DOCKER_HOST
    ) {
      env.DOCKER_HOST = "npipe:////./pipe/dockerDesktopLinuxEngine";
    }
    const child = spawn(target.command, target.args, {
      env,
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

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
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
          reject(new Error("Unable to allocate a local Postgres test port."));
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
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", "rankmap_test"],
      { allowFailure: true, stdio: "pipe" },
    );

    if (result.code === 0) return;
    await delay(1000);
  }

  throw new Error("Timed out waiting for the API E2E Postgres container.");
}

async function ensureDockerAvailable() {
  const result = await run("docker", ["info"], { allowFailure: true, stdio: "pipe" });
  if (result.code === 0) return;

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  throw new Error(
    [
      "Docker is required for API E2E because this script starts a disposable Postgres container.",
      "Start Docker Desktop or make the Docker daemon reachable, then rerun `corepack pnpm run test:e2e:api`.",
      output,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

try {
  await ensureDockerAvailable();

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
    `127.0.0.1:${port}:5432`,
    "-d",
    "postgres:16-alpine",
  ]);

  await waitForPostgres();

  await run("corepack", ["pnpm", "--filter", "@workspace/db", "run", "migrate"], {
    env: { DATABASE_URL: databaseUrl },
  });

  const e2eFiles = [
    "artifacts/api-server/src/routes/api.e2e.test.ts",
    "artifacts/api-server/src/routes/api.boundary.e2e.test.ts",
    "artifacts/api-server/src/routes/api.concurrency.e2e.test.ts",
  ];

  for (const e2eFile of e2eFiles) {
    await run("corepack", ["pnpm", "exec", "vitest", "run", e2eFile], {
      env: {
        DATABASE_URL: databaseUrl,
        NODE_ENV: "test",
        RUN_API_E2E: "1",
        SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      },
    });
  }
} finally {
  await run("docker", ["rm", "-f", containerName], { allowFailure: true });
}
