import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(repoRoot, "artifacts", "recovery-baseline");
const backupPath = path.join(artifactsDir, "rankmap-backup-restore-baseline.dump");
const sourceContainer = `rankmap-backup-source-${Date.now()}`;
const restoreContainer = `rankmap-backup-restore-${Date.now()}`;
const sourcePort = String(await getFreePort());
const restorePort = String(await getFreePort());
const sourceDatabaseUrl = `postgresql://rankmap:rankmap@localhost:${sourcePort}/rankmap_backup_source`;

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

function pipeToFile(command, args, filePath) {
  return new Promise((resolve, reject) => {
    const target = spawnTarget(command, args);
    const child = spawn(target.command, target.args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = createWriteStream(filePath);
    let stderr = "";

    child.stdout.pipe(output);
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    output.on("error", reject);
    child.on("close", (code) => {
      output.end();
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stderr}`));
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
          reject(new Error("Unable to allocate a local test port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function startPostgres(containerName, port, databaseName) {
  await run("docker", [
    "run",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=rankmap",
    "-e",
    "POSTGRES_PASSWORD=rankmap",
    "-e",
    `POSTGRES_DB=${databaseName}`,
    "-p",
    `127.0.0.1:${port}:5432`,
    "-d",
    "postgres:16-alpine",
  ]);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await run(
      "docker",
      ["exec", containerName, "pg_isready", "-U", "rankmap", "-d", databaseName],
      { allowFailure: true, stdio: "pipe" },
    );
    if (result.code === 0) return;
    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${containerName}.`);
}

async function psql(containerName, databaseName, sql) {
  const result = await run(
    "docker",
    [
      "exec",
      containerName,
      "psql",
      "-U",
      "rankmap",
      "-d",
      databaseName,
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      sql,
    ],
    { stdio: "pipe" },
  );
  return result.stdout.trim();
}

async function seedSourceDatabase() {
  const sql = `
    insert into tenants (id, name, plan, seats_used, seats_max)
    values (1001, 'Recovery Baseline Tenant', 'agency', 2, 10);

    insert into users (id, tenant_id, email, password_hash, full_name, role)
    values
      (2001, 1001, 'recovery-owner@rankmap.test', 'not-used-in-recovery-baseline', 'Recovery Owner', 'agency_admin'),
      (2002, 1001, 'recovery-user@rankmap.test', 'not-used-in-recovery-baseline', 'Recovery User', 'agency_user');

    insert into clients (id, tenant_id, name, domain, industry)
    values (3001, 1001, 'Recovery Client', 'recovery.example.com', 'Software');

    insert into projects (id, tenant_id, client_id, name, target_domain, locale)
    values (4001, 1001, 3001, 'Recovery Project', 'recovery.example.com', 'en-US');

    insert into keywords (project_id, tenant_id, phrase, search_volume, cpc, kd, intent, source, final_score)
    select
      4001,
      1001,
      'recovery keyword ' || gs,
      1000 + gs,
      1 + (gs::real / 100),
      20 + (gs % 50),
      case when gs % 4 = 0 then 'informational' when gs % 4 = 1 then 'commercial' when gs % 4 = 2 then 'transactional' else 'navigational' end,
      'manual',
      50 + (gs % 50)
    from generate_series(1, 120) as gs;

    insert into ai_tasks (project_id, tenant_id, task_type, provider, status, input, output, created_by)
    select
      4001,
      1001,
      case when gs % 3 = 0 then 'brief' when gs % 3 = 1 then 'cluster' else 'report' end,
      'mock',
      case when gs <= 30 then 'queued' when gs <= 45 then 'running' else 'completed' end,
      jsonb_build_object('recoveryIndex', gs),
      case when gs > 45 then jsonb_build_object('mock', true, 'taskId', gs) else null end,
      2001
    from generate_series(1, 60) as gs;

    insert into reports (project_id, tenant_id, type, format, generated_at, data)
    values
      (4001, 1001, 'project_summary', 'json', now(), jsonb_build_object('summary', 'recovery baseline')),
      (4001, 1001, 'content_pipeline', 'json', now(), jsonb_build_object('items', 120));
  `;
  await psql(sourceContainer, "rankmap_backup_source", sql);
}

async function collectFingerprint(containerName, databaseName) {
  const sql = `
    select json_build_object(
      'tenants', (select count(*) from tenants),
      'users', (select count(*) from users),
      'clients', (select count(*) from clients),
      'projects', (select count(*) from projects),
      'keywords', (select count(*) from keywords),
      'aiTasks', (select count(*) from ai_tasks),
      'reports', (select count(*) from reports),
      'keywordChecksum', (select md5(string_agg(phrase || ':' || search_volume || ':' || coalesce(final_score::text, ''), '|' order by phrase)) from keywords),
      'taskChecksum', (select md5(string_agg(task_type || ':' || status || ':' || provider, '|' order by id)) from ai_tasks),
      'reportChecksum', (select md5(string_agg(type || ':' || format, '|' order by id)) from reports)
    )::text;
  `;
  return JSON.parse(await psql(containerName, databaseName, sql));
}

function assertFingerprintsMatch(source, restored) {
  const mismatches = Object.keys(source).filter((key) => source[key] !== restored[key]);
  if (mismatches.length > 0) {
    throw new Error(
      `Restored database fingerprint mismatch: ${mismatches
        .map((key) => `${key} source=${source[key]} restored=${restored[key]}`)
        .join("; ")}`,
    );
  }
}

try {
  await rm(artifactsDir, { force: true, recursive: true });
  await mkdir(artifactsDir, { recursive: true });
  await startPostgres(sourceContainer, sourcePort, "rankmap_backup_source");
  await startPostgres(restoreContainer, restorePort, "rankmap_backup_restore");

  await run("corepack", ["pnpm", "--filter", "@workspace/db", "run", "migrate"], {
    env: { DATABASE_URL: sourceDatabaseUrl },
  });
  await seedSourceDatabase();

  const sourceFingerprint = await collectFingerprint(sourceContainer, "rankmap_backup_source");

  const dumpStarted = performance.now();
  await pipeToFile(
    "docker",
    [
      "exec",
      sourceContainer,
      "pg_dump",
      "-U",
      "rankmap",
      "-d",
      "rankmap_backup_source",
      "-Fc",
      "--no-owner",
      "--no-acl",
    ],
    backupPath,
  );
  const dumpMs = Math.round(performance.now() - dumpStarted);

  await run("docker", ["cp", backupPath, `${restoreContainer}:/tmp/rankmap-recovery.dump`], {
    stdio: "pipe",
  });

  const restoreStarted = performance.now();
  await run(
    "docker",
    [
      "exec",
      restoreContainer,
      "pg_restore",
      "-U",
      "rankmap",
      "-d",
      "rankmap_backup_restore",
      "--no-owner",
      "--no-acl",
      "/tmp/rankmap-recovery.dump",
    ],
    { stdio: "pipe" },
  );
  const restoreMs = Math.round(performance.now() - restoreStarted);

  const restoredFingerprint = await collectFingerprint(restoreContainer, "rankmap_backup_restore");
  assertFingerprintsMatch(sourceFingerprint, restoredFingerprint);

  console.log("\nBackup/restore baseline");
  console.log(`Dump completed in ${dumpMs}ms`);
  console.log(`Restore completed in ${restoreMs}ms`);
  console.log(
    `Verified tenants=${restoredFingerprint.tenants}, users=${restoredFingerprint.users}, clients=${restoredFingerprint.clients}, projects=${restoredFingerprint.projects}, keywords=${restoredFingerprint.keywords}, aiTasks=${restoredFingerprint.aiTasks}, reports=${restoredFingerprint.reports}`,
  );
} finally {
  await run("docker", ["rm", "-f", sourceContainer], { allowFailure: true, stdio: "pipe" });
  await run("docker", ["rm", "-f", restoreContainer], { allowFailure: true, stdio: "pipe" });
}
