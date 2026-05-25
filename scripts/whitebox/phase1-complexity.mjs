import ts from "typescript";
import { mkdir, writeFile } from "node:fs/promises";

const ROOT = process.cwd();
const TARGET_GLOBS = [
  "artifacts/api-server/src/**/*.ts",
  "lib/db/src/**/*.ts",
];

function collectFiles() {
  const all = ts.sys.readDirectory(ROOT, [".ts"], undefined, TARGET_GLOBS);
  return all.filter((f) => !f.endsWith(".d.ts") && !f.endsWith(".test.ts"));
}

function functionName(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  }
  return "<anonymous>";
}

function complexityForFunction(body) {
  let c = 1;
  function walk(node) {
    if (
      ts.isIfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCatchClause(node)
    ) {
      c += 1;
    }
    if (ts.isSwitchStatement(node)) {
      c += node.caseBlock.clauses.length;
    }
    if (ts.isConditionalExpression(node)) c += 1;
    if (ts.isBinaryExpression(node)) {
      if (
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken
      ) {
        c += 1;
      }
    }
    ts.forEachChild(node, walk);
  }
  if (body) walk(body);
  return c;
}

function analyzeFile(filePath) {
  const text = ts.sys.readFile(filePath) ?? "";
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const functions = [];

  function visit(node) {
    const isFn =
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node);
    if (isFn) {
      const body = node.body;
      const complexity = complexityForFunction(body);
      const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
      functions.push({
        file: filePath.replaceAll("\\", "/"),
        line: pos.line + 1,
        name: functionName(node),
        complexity,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return functions;
}

const files = collectFiles();
const functions = files.flatMap(analyzeFile).sort((a, b) => b.complexity - a.complexity);
const top = functions.slice(0, 25);

const map = {
  generatedAt: new Date().toISOString(),
  filesAnalyzed: files.length,
  functionCount: functions.length,
  topFunctions: top,
};

await mkdir("artifacts/whitebox", { recursive: true });
await writeFile("artifacts/whitebox/phase1-complexity.json", `${JSON.stringify(map, null, 2)}\n`, "utf8");

const lines = [
  "# INTERNAL_STRUCTURE_MAP",
  "",
  `- Files analyzed: ${map.filesAnalyzed}`,
  `- Functions analyzed: ${map.functionCount}`,
  "",
  "## Highest Cyclomatic Targets",
  ...top.slice(0, 10).map(
    (f, i) =>
      `${i + 1}. \`${f.name}\` — complexity ${f.complexity} — \`${f.file}:${f.line}\``,
  ),
  "",
];
await writeFile("artifacts/whitebox/INTERNAL_STRUCTURE_MAP.md", `${lines.join("\n")}\n`, "utf8");

console.log(JSON.stringify({ filesAnalyzed: map.filesAnalyzed, functionCount: map.functionCount }));
