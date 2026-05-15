#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const workspaceRoot = resolve(import.meta.dirname, "..");
const fakeValuePattern = /fake|placeholder|change-me|donotuse/i;
const truthyPattern = /^(1|true|yes)$/i;

loadEnvFile(".env.local");
loadEnvFile(".env");

const errors = [];
const warnings = [];

validateProductionEnv();

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`FAIL ${error}`);
  }
  for (const warning of warnings) {
    console.warn(`WARN ${warning}`);
  }
  process.exit(1);
}

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

await maybeRunMigrations();
await maybeRunLiveServiceDiagnostics();
await maybeCheckHealthEndpoint();

console.log("Deployment preflight passed.");

function validateProductionEnv() {
  requireEnv("NODE_ENV");
  if (process.env.NODE_ENV !== "production" && !isTruthy("PREFLIGHT_ALLOW_NON_PRODUCTION")) {
    errors.push("NODE_ENV must be production for deployment preflight.");
  }

  requireEnv("DATABASE_URL");
  requireEnv("SESSION_SECRET");
  requireEnv("PORT");
  requireEnv("APP_URL", { alternate: "PUBLIC_APP_URL" });

  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0) {
    errors.push("PORT must be a positive integer.");
  }

  const sessionSecret = envValue("SESSION_SECRET");
  if (sessionSecret && sessionSecret.length < 32) {
    errors.push("SESSION_SECRET must be at least 32 characters.");
  }

  const appUrl = envValue("APP_URL") ?? envValue("PUBLIC_APP_URL");
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol !== "https:" && !isTruthy("PREFLIGHT_ALLOW_INSECURE_APP_URL")) {
        errors.push("APP_URL/PUBLIC_APP_URL must use https in production.");
      }
    } catch {
      errors.push("APP_URL/PUBLIC_APP_URL must be a valid URL.");
    }
  }

  if (isTruthy("FEATURE_BILLING") || isTruthy("FEATURE_STRIPE_BILLING")) {
    requireEnv("STRIPE_SECRET_KEY");
    requireEnv("STRIPE_WEBHOOK_SECRET");
    requireEnv("STRIPE_PRICE_SOLO");
    requireEnv("STRIPE_PRICE_AGENCY");
    requireEnv("STRIPE_PRICE_ENTERPRISE");
  }

  if (isTruthy("FEATURE_AI_CLUSTERING")) {
    requireEnv("OPENAI_API_KEY");
  }

  if (isTruthy("FEATURE_AHREFS_IMPORT")) {
    requireEnv("AHREFS_API_KEY");
  }

  if (isTruthy("FEATURE_SEMRUSH_IMPORT")) {
    requireEnv("SEMRUSH_API_KEY");
  }

  if (envValue("DATAFORSEO_LOGIN") || envValue("DATAFORSEO_PASSWORD")) {
    requireEnv("DATAFORSEO_LOGIN");
    requireEnv("DATAFORSEO_PASSWORD");
  }

  if (envValue("SMTP_HOST")) {
    requireEnv("SMTP_USER");
    requireEnv("SMTP_PASS");
    const smtpPort = Number(process.env.SMTP_PORT || "587");
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
      errors.push("SMTP_PORT must be a positive integer.");
    }
  }
}

async function maybeRunMigrations() {
  if (isTruthy("PREFLIGHT_SKIP_MIGRATIONS")) {
    console.log("SKIP database migrations: PREFLIGHT_SKIP_MIGRATIONS is true.");
    return;
  }

  console.log("Running database migrations...");
  await run("corepack", ["pnpm", "run", "db:migrate"]);
}

async function maybeRunLiveServiceDiagnostics() {
  if (isTruthy("PREFLIGHT_SKIP_LIVE_SERVICES")) {
    console.log("SKIP live service diagnostics: PREFLIGHT_SKIP_LIVE_SERVICES is true.");
    return;
  }

  if (!hasAnyLiveCredential()) {
    console.log("SKIP live service diagnostics: no live provider credentials configured.");
    return;
  }

  console.log("Running live service diagnostics...");
  await run("corepack", ["pnpm", "run", "test:live:services"], {
    env: { LIVE_SERVICES_OPTIONAL: "1" },
  });
}

async function maybeCheckHealthEndpoint() {
  const healthUrl = envValue("PREFLIGHT_HEALTH_URL") ?? envValue("HEALTHCHECK_URL");

  if (!healthUrl) {
    console.log("SKIP deployed health check: set PREFLIGHT_HEALTH_URL after app start.");
    return;
  }

  const attempts = Number(process.env.PREFLIGHT_HEALTH_ATTEMPTS || "20");
  const delayMs = Number(process.env.PREFLIGHT_HEALTH_DELAY_MS || "3000");

  if (!Number.isInteger(attempts) || attempts <= 0) {
    throw new Error("PREFLIGHT_HEALTH_ATTEMPTS must be a positive integer.");
  }

  console.log(`Checking deployed health endpoint: ${redactUrl(healthUrl)}`);
  let lastError = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.json();

      if (response.ok && body.status === "ok") {
        console.log("PASS deployed health check");
        return;
      }

      lastError = `HTTP ${response.status}, status=${body.status ?? "missing"}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < attempts) {
      await delay(delayMs);
    }
  }

  throw new Error(`Deployed health check failed: ${lastError}`);
}

function hasAnyLiveCredential() {
  return [
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "SMTP_HOST",
    "AHREFS_API_KEY",
    "SEMRUSH_API_KEY",
    "DATAFORSEO_LOGIN",
    "DATAFORSEO_PASSWORD",
  ].some((name) => envValue(name));
}

function requireEnv(name, options = {}) {
  if (envValue(name) || (options.alternate && envValue(options.alternate))) {
    return;
  }

  const label = options.alternate ? `${name} or ${options.alternate}` : name;
  errors.push(`${label} is required and must not be a placeholder.`);
}

function envValue(name) {
  const value = process.env[name]?.trim();
  if (!value || fakeValuePattern.test(value)) {
    return undefined;
  }
  return value;
}

function isTruthy(name) {
  return truthyPattern.test(process.env[name] ?? "");
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const target = spawnTarget(command, args);
    const child = spawn(target.command, target.args, {
      cwd: workspaceRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
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

function quoteWindowsArg(value) {
  return /\s/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function loadEnvFile(name) {
  const path = resolve(workspaceRoot, name);
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = unquote(match[2]);
  }
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = "[redacted]";
      url.password = "[redacted]";
    }
    return url.toString();
  } catch {
    return "[invalid-url]";
  }
}
