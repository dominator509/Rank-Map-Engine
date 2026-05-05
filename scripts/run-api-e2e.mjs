import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const containerName = `rankmap-api-e2e-${Date.now()}`;
const port = String(55000 + Math.floor(Math.random() * 5000));
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

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
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
    "POSTGRES_DB=rankmap_test",
    "-p",
    `${port}:5432`,
    "-d",
    "postgres:16-alpine",
  ]);

  await waitForPostgres();

  await run("corepack", ["pnpm", "--filter", "@workspace/db", "run", "push"], {
    env: { DATABASE_URL: databaseUrl },
  });

  await run(
    "corepack",
    ["pnpm", "exec", "vitest", "run", "artifacts/api-server/src/routes/api.e2e.test.ts"],
    {
      env: {
        DATABASE_URL: databaseUrl,
        NODE_ENV: "test",
        RUN_API_E2E: "1",
        SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      },
    },
  );
} finally {
  await run("docker", ["rm", "-f", containerName], { allowFailure: true });
}
