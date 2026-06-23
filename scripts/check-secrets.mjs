import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const IGNORED_PATH_PARTS = [
  "/node_modules/",
  "/dist/",
  "/build/",
  "/.git/",
  "/.replit-artifact/",
  "/.config/.semgrep/",
];

const PATTERNS = [
  {
    name: "OpenAI API key",
    pattern: /sk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  },
  {
    name: "Stripe API key",
    pattern: /\b[ps]k_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: "Stripe webhook secret",
    pattern: /\bwhsec_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: "RankMap API key",
    pattern: /\brm_[a-f0-9]{64}\b/gi,
  },
  {
    name: "AWS access key id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "Private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
];

function isProbablyText(buffer) {
  return !buffer.includes(0);
}

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((file) => {
      const normalized = `/${file.replaceAll("\\", "/")}`;
      return !IGNORED_PATH_PARTS.some((part) => normalized.includes(part));
    });
}

const findings = [];

for (const file of trackedFiles()) {
  const buffer = readFileSync(file);
  if (buffer.length > MAX_FILE_BYTES || !isProbablyText(buffer)) continue;

  const text = buffer.toString("utf8");
  const lineStarts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  }

  for (const { name, pattern } of PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const line = lineStarts.findLastIndex((start) => start <= index) + 1;
      findings.push({ file, line, name });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.name})`);
  }
  process.exit(1);
}

console.log("Secret scan passed: no high-confidence secret patterns found.");
