import { createClient, writeOut } from "./common.mjs";

export default async function runPhase4(baseUrl) {
  const anon = createClient(baseUrl);

  const unauthorized = await anon.request("/api/clients", { method: "GET" });
  const malformedJson = await anon.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{not-json" });
  const wrongContentType = await anon.request("/api/auth/login", { method: "POST", headers: { "content-type": "text/plain" }, body: "email=a@b.com&password=x" });
  const outOfSequence = await anon.request("/api/projects/999999/keywords", { method: "GET" });

  const checks = [unauthorized, malformedJson, wrongContentType, outOfSequence].map((r) => ({ status: r.status, body: r.body }));
  const leaks = checks.filter((c) => JSON.stringify(c.body).match(/stack|drizzle|postgres|express|sequelize|prisma|at\s+\w+/i));

  const out = { phase: 4, baseUrl, checks, leakageFindings: leaks };
  await writeOut("results/phase4-results.json", JSON.stringify(out, null, 2));
  console.log(`Phase 4 complete: ${leaks.length} potential leakage responses detected.`);
}
