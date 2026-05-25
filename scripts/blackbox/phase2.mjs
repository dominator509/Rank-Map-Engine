import { createClient, writeOut } from "./common.mjs";

export default async function runPhase2(baseUrl) {
  const api = createClient(baseUrl);
  const results = [];
  const ts = Date.now();
  const email = `bb${ts}@example.com`;

  results.push({ name: "register-valid", ...(await api.request("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "P@ssword12345", fullName: "Black Box", tenantName: "QA Tenant" }) })) });
  results.push({ name: "register-missing-required", ...(await api.request("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `miss${ts}@example.com` }) })) });

  results.push({ name: "create-client-valid", ...(await api.request("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Client Boundary", domain: "example.com", industry: "tech" }) })) });
  results.push({ name: "create-client-empty-name", ...(await api.request("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "" }) })) });
  results.push({ name: "create-client-large-name", ...(await api.request("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "A".repeat(1024) }) })) });

  const out = { phase: 2, baseUrl, results };
  await writeOut("mocks/phase2-payloads.json", JSON.stringify({ validRegister: { email, password: "P@ssword12345", fullName: "Black Box", tenantName: "QA Tenant" }, invalidRegister: { email: `miss${ts}@example.com` }, clientValid: { name: "Client Boundary", domain: "example.com", industry: "tech" }, clientEmpty: { name: "" }, clientLarge: { name: "A".repeat(1024) } }, null, 2));
  await writeOut("results/phase2-results.json", JSON.stringify(out, null, 2));

  const pass = results.filter((r) => [200, 201, 400, 401, 409, 422].includes(r.status)).length;
  console.log(`Phase 2 complete: ${pass}/${results.length} responses in expected class.`);
}
