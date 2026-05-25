#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";
import tls from "node:tls";

const workspaceRoot = resolve(import.meta.dirname, "..");
const fakeValuePattern = /fake|placeholder|change-me|donotuse/i;
const truthyPattern = /^(1|true|yes)$/i;
const liveServicesOptional =
  truthyPattern.test(process.env.LIVE_SERVICES_OPTIONAL ?? "") ||
  truthyPattern.test(process.env.ALLOW_NO_LIVE_SERVICE_CREDENTIALS ?? "");

loadEnvFile(".env.local");
loadEnvFile(".env");

let attempted = 0;
let passed = 0;
let failed = 0;
let skipped = 0;

await check("OpenAI chat completions", ["OPENAI_API_KEY"], async () => {
  const data = await fetchJson("OpenAI", "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: 'Return exactly this JSON object and no prose: {"ok":true}',
        },
      ],
      temperature: 0,
      max_tokens: 30,
      response_format: { type: "json_object" },
    }),
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content || JSON.parse(content).ok !== true) {
    throw new Error("OpenAI returned an unexpected response shape.");
  }
});

await check(
  "Stripe billing configuration",
  [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_SOLO",
    "STRIPE_PRICE_AGENCY",
    "STRIPE_PRICE_ENTERPRISE",
  ],
  async () => {},
);

await check("Stripe API", ["STRIPE_SECRET_KEY"], async () => {
  const data = await fetchJson("Stripe", "https://api.stripe.com/v1/balance", {
    headers: {
      Authorization: `Bearer ${requiredEnv("STRIPE_SECRET_KEY")}`,
    },
  });

  if (data?.object !== "balance") {
    throw new Error("Stripe balance endpoint returned an unexpected response shape.");
  }
});

await check("SMTP connectivity", ["SMTP_HOST"], async () => {
  const port = Number(process.env.SMTP_PORT || "587");
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive integer.");
  }

  await probeTcp(requiredEnv("SMTP_HOST"), port, port === 465);
});

const runKeywordProviderChecks = truthyPattern.test(process.env.LIVE_KEYWORD_PROVIDER_CHECKS ?? "");

await checkKeywordProvider("Ahrefs keyword import", ["AHREFS_API_KEY"], async () => {
  const url = new URL("https://api.ahrefs.com/v3/keywords-explorer/overview");
  url.searchParams.set("select", "keyword,volume,cpc,difficulty");
  url.searchParams.set("keywords", process.env.LIVE_KEYWORD_QUERY || "seo software");
  url.searchParams.set("country", "us");

  await fetchJson("Ahrefs", url.toString(), {
    headers: {
      Authorization: `Bearer ${requiredEnv("AHREFS_API_KEY")}`,
    },
  });
});

if (!truthyPattern.test(process.env.ALLOW_SEMRUSH_QUERY_AUTH ?? "")) {
  skipped += 1;
  console.log(
    "SKIP SEMrush keyword import: Semrush requires query-string API key auth; set ALLOW_SEMRUSH_QUERY_AUTH=true to opt in.",
  );
} else {
  await checkKeywordProvider("SEMrush keyword import", ["SEMRUSH_API_KEY"], async () => {
    const url = new URL("https://api.semrush.com/");
    url.searchParams.set("type", "phrase_related");
    url.searchParams.set("key", requiredEnv("SEMRUSH_API_KEY"));
    url.searchParams.set("phrase", process.env.LIVE_KEYWORD_QUERY || "seo software");
    url.searchParams.set("database", "us");
    url.searchParams.set("export_columns", "Ph,Nq,Cp,Kd");
    url.searchParams.set("display_limit", "10");

    const text = await fetchText("SEMrush", url.toString());
    if (/^ERROR/i.test(text.trim())) {
      throw new Error(text.trim().slice(0, 250));
    }
  });
}

await checkKeywordProvider(
  "DataForSEO keyword import",
  ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
  async () => {
    const auth = Buffer.from(
      `${requiredEnv("DATAFORSEO_LOGIN")}:${requiredEnv("DATAFORSEO_PASSWORD")}`,
    ).toString("base64");

    const data = await fetchJson(
      "DataForSEO",
      "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify([
          {
            keywords: [process.env.LIVE_KEYWORD_QUERY || "seo software"],
            location_code: 2840,
            language_code: "en",
          },
        ]),
      },
    );

    const task = data?.tasks?.[0];
    if (task?.status_code && task.status_code >= 40000) {
      throw new Error(task.status_message || "DataForSEO task failed.");
    }
  },
);

console.log(`\nLive service diagnostics: ${passed} passed, ${failed} failed, ${skipped} skipped.`);

if (attempted === 0) {
  const message = "No live provider credentials were available, so no live checks could run.";
  if (liveServicesOptional) {
    console.log(message);
  } else {
    console.error(message);
    process.exitCode = 1;
  }
} else if (failed > 0) {
  process.exitCode = 1;
}

async function check(name, requiredNames, run) {
  const missing = requiredNames.filter((key) => !envValue(key));
  if (missing.length > 0) {
    skipped += 1;
    console.log(`SKIP ${name}: missing ${missing.join(", ")}`);
    return;
  }

  attempted += 1;
  try {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${sanitizeError(err)}`);
  }
}

async function checkKeywordProvider(name, requiredNames, run) {
  const missing = requiredNames.filter((key) => !envValue(key));
  if (missing.length > 0) {
    skipped += 1;
    console.log(`SKIP ${name}: missing ${missing.join(", ")}`);
    return;
  }

  if (!runKeywordProviderChecks) {
    skipped += 1;
    console.log(`SKIP ${name}: set LIVE_KEYWORD_PROVIDER_CHECKS=true to spend provider quota.`);
    return;
  }

  await check(name, requiredNames, run);
}

async function fetchJson(name, url, options = {}) {
  const text = await fetchText(name, url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} returned non-JSON data.`);
  }
}

async function fetchText(name, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();

  if (!response.ok) {
    let message = text.slice(0, 250);
    try {
      const data = JSON.parse(text);
      message = data?.error?.message || data?.message || message;
    } catch {
      // Keep the short raw response preview.
    }
    throw new Error(`${name} returned HTTP ${response.status}: ${message}`);
  }

  return text;
}

function probeTcp(host, port, secure) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });

    const settle = (err) => {
      socket.destroy();
      if (err) rejectPromise(err);
      else resolvePromise();
    };

    socket.setTimeout(10000, () => settle(new Error("SMTP connection timed out.")));
    socket.once(secure ? "secureConnect" : "connect", () => settle());
    socket.once("error", settle);
  });
}

function envValue(name) {
  const value = process.env[name]?.trim();
  if (!value || fakeValuePattern.test(value)) {
    return undefined;
  }
  return value;
}

function requiredEnv(name) {
  const value = envValue(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
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

function sanitizeError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/sk_(live|test)_[A-Za-z0-9_]+/g, "sk_$1_[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .slice(0, 500);
}
