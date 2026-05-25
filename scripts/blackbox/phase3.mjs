import { createClient, writeOut } from "./common.mjs";

export default async function runPhase3(baseUrl) {
  const api = createClient(baseUrl);
  const ts = Date.now();
  const email = `workflow${ts}@example.com`;

  const register = await api.request("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "P@ssword12345", fullName: "Workflow User", tenantName: "Workflow Tenant" }) });
  const me = await api.request("/api/auth/me", { method: "GET" });
  const createClient = await api.request("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Workflow Client" }) });
  const clientId = createClient.body?.id;
  const getClient = clientId ? await api.request(`/api/clients/${clientId}`, { method: "GET" }) : { status: 0, body: { error: "client not created" } };

  const out = { phase: 3, baseUrl, steps: { register, me, createClient, getClient } };
  await writeOut("results/phase3-results.json", JSON.stringify(out, null, 2));
  console.log("Phase 3 complete: workflow sequence executed.");
}
