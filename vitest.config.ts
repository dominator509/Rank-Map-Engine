import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "artifacts/api-server/src/**/*.test.ts",
      "lib/*/src/**/*.test.ts",
      "scripts/src/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["artifacts/api-server/src/**", "lib/*/src/**"],
      exclude: ["**/*.test.ts", "**/generated/**", "**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@workspace/api-zod": path.resolve("lib/api-zod/src/index.ts"),
      "@workspace/db": path.resolve("lib/db/src/index.ts"),
    },
  },
});
