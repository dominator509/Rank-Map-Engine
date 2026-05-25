import { readOpenApiText, summarizePaths, writeOut } from "./common.mjs";

export default async function runPhase1() {
  const text = await readOpenApiText();
  const paths = summarizePaths(text);
  const map = [
    "# EXTERNAL_INTERFACE_MAP",
    "",
    "Derived strictly from `lib/api-spec/openapi.yaml`.",
    "",
    "| Method | Path | Operation | Auth |",
    "|---|---|---|---|",
    ...paths.map((p) => `| ${p.method} | ${p.path} | ${p.operationId || "n/a"} | ${p.auth} |`),
  ].join("\n");

  console.log(map);
  await writeOut("EXTERNAL_INTERFACE_MAP.md", map + "\n");
  console.log("Phase 1 complete: interface map generated.");
}
