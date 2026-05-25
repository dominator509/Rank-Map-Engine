import { startSystem } from "./common.mjs";

const phase = process.argv[2];
if (!phase || !["1", "2", "3", "4", "5"].includes(phase)) {
  console.error("Usage: node scripts/blackbox/run-phase.mjs <1|2|3|4|5>");
  process.exit(1);
}

if (phase === "1") {
  const { default: runPhase1 } = await import("./phase1.mjs");
  await runPhase1();
  process.exit(0);
}

const system = await startSystem();
try {
  const mod = await import(`./phase${phase}.mjs`);
  await mod.default(system.baseUrl);
} finally {
  await system.stop();
}
