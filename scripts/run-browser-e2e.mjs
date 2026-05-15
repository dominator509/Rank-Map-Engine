import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const containerName = `rankmap-browser-e2e-${Date.now()}`;
const postgresPort = String(await getFreePort());
const apiPort = String(await getFreePort());
const webPort = String(await getFreePort());
const databaseUrl = `postgresql://rankmap:rankmap@localhost:${postgresPort}/rankmap_browser_e2e`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const managedProcesses = [];

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
    let settled = false;

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

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          killProcessTree(child);
          const output = [stdout, stderr].filter(Boolean).join("\n").trim();
          reject(
            new Error(
              `${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms${
                output ? `\n${output}` : ""
              }`,
            ),
          );
        }, options.timeoutMs)
      : null;

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);

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

function killProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
    return;
  }

  child.kill("SIGTERM");
  setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 5000).unref();
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
      const text = chunk.toString();
      logs.push(
        ...text
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => `[${name}] ${line}`),
      );
      if (logs.length > 80) logs.splice(0, logs.length - 80);
    });
  };

  capture(child.stdout);
  capture(child.stderr);

  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      logs.push(`[${name}] exited with code ${code}`);
    } else if (signal) {
      logs.push(`[${name}] exited with signal ${signal}`);
    }
  });

  managedProcesses.push({ child, logs, name });
  return { child, logs, name };
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
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", "rankmap_browser_e2e"],
      { allowFailure: true, stdio: "pipe" },
    );

    if (result.code === 0) return;
    await delay(1000);
  }

  throw new Error("Timed out waiting for the browser E2E Postgres container.");
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
    "POSTGRES_DB=rankmap_browser_e2e",
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
      ALLOWED_ORIGINS: webUrl,
      DATABASE_URL: databaseUrl,
      FEATURE_BILLING: "false",
      FEATURE_STRIPE_BILLING: "false",
      NODE_ENV: "test",
      PORT: apiPort,
      SESSION_SECRET: "browser-e2e-session-secret-with-at-least-32-characters",
    },
  );

  await waitForHttp(`${apiUrl}/api/healthz`, "API server", apiProcess);

  const webProcess = startManagedProcess(
    "web",
    "corepack",
    ["pnpm", "--filter", "@workspace/rankmap", "run", "dev"],
    {
      API_SERVER_URL: apiUrl,
      BASE_PATH: "/",
      NODE_ENV: "test",
      PORT: webPort,
    },
  );

  await waitForHttp(webUrl, "frontend server", webProcess);

  const playwrightArgs = ["pnpm", "exec", "playwright", "test", "--project=chromium"];
  if (process.env.UPDATE_PLAYWRIGHT_SNAPSHOTS === "1") {
    playwrightArgs.push("--update-snapshots");
  }

  await run("corepack", playwrightArgs, {
    env: {
      PLAYWRIGHT_BASE_URL: webUrl,
    },
    stdio: "pipe",
    timeoutMs: 120_000,
  });
} finally {
  await stopManagedProcesses();
  await run("docker", ["rm", "-f", containerName], { allowFailure: true });
}
