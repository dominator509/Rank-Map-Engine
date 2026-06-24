import { spawn } from "node:child_process";

const steps = [
  ["api e2e smoke", "corepack", ["pnpm", "run", "test:e2e:api"]],
  ["browser e2e smoke", "corepack", ["pnpm", "run", "test:e2e:browser"]],
];

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

function runStep(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[smoke] ${label}`);
    const target = spawnTarget(command, args);
    const child = spawn(target.command, target.args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

for (const [label, command, args] of steps) {
  await runStep(label, command, args);
}

console.log("\n[smoke] API and browser smoke checks passed.");
