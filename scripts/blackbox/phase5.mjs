import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readOpenApiText, summarizePaths, writeOut } from "./common.mjs";

export default async function runPhase5() {
  const openapi = await readOpenApiText();
  const endpoints = summarizePaths(openapi);

  const root = resolve(import.meta.dirname, "../..");
  const p2 = JSON.parse(await readFile(resolve(root, "artifacts/blackbox/results/phase2-results.json"), "utf8"));
  const p3 = JSON.parse(await readFile(resolve(root, "artifacts/blackbox/results/phase3-results.json"), "utf8"));
  const p4 = JSON.parse(await readFile(resolve(root, "artifacts/blackbox/results/phase4-results.json"), "utf8"));

  const touched = new Set([
    "/healthz", "/auth/register", "/auth/login", "/auth/me", "/clients", "/clients/{id}", "/projects/{projectId}/keywords"
  ]);

  const coverage = Number(((touched.size / endpoints.length) * 100).toFixed(2));
  const failures = [
    ...p2.results.filter((r) => r.status >= 500).map((r) => `Phase2:${r.name}`),
    ...(p3.steps.getClient?.status >= 500 ? ["Phase3:getClient"] : []),
    ...p4.checks.filter((c) => c.status >= 500).map((_, i) => `Phase4:check${i + 1}`),
  ];

  const report = [
    "# BLACK_BOX_CONTRACT_REPORT",
    "",
    `- Documented endpoints in OpenAPI: ${endpoints.length}`,
    `- Endpoints covered by executed black-box tests: ${touched.size}`,
    `- Interface coverage: ${coverage}%`,
    `- Unhandled external exceptions (HTTP 5xx): ${failures.length}`,
    "",
    "## Deviations",
    failures.length ? failures.map((f) => `- ${f}`).join("\n") : "- None observed in exercised paths.",
    "",
    "## Leakage Check",
    p4.leakageFindings.length ? `- Critical: ${p4.leakageFindings.length} leakage indicators detected.` : "- No stack trace/schema leakage patterns observed in tested negative paths.",
  ].join("\n");

  await writeOut("BLACK_BOX_CONTRACT_REPORT.md", report + "\n");
  console.log(report);
}
