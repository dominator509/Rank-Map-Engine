import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";

function parsePort(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`Invalid PORT value: "${value}"`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: "${value}"`);
  }

  return parsed;
}

const port = parsePort(rawPort);

const basePath = process.env.BASE_PATH ?? "/";
const apiServerUrl = process.env.API_SERVER_URL ?? "http://localhost:8080";

const dependencyChunk = (id: string) => {
  const normalizedId = id.replaceAll("\\", "/");

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  if (normalizedId.includes("/lucide-react/")) {
    return "icons";
  }

  if (normalizedId.includes("/@radix-ui/")) {
    return "radix-ui";
  }

  if (
    normalizedId.includes("/react/") ||
    normalizedId.includes("/react-dom/") ||
    normalizedId.includes("/scheduler/")
  ) {
    return "react";
  }

  if (
    normalizedId.includes("/recharts/") ||
    normalizedId.includes("/d3-") ||
    normalizedId.includes("/victory-vendor/")
  ) {
    return "charts";
  }

  if (normalizedId.includes("/@tanstack/")) {
    return "tanstack";
  }

  if (
    normalizedId.includes("/class-variance-authority/") ||
    normalizedId.includes("/clsx/") ||
    normalizedId.includes("/date-fns/") ||
    normalizedId.includes("/tailwind-merge/")
  ) {
    return "ui-utils";
  }

  return undefined;
};

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: dependencyChunk,
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "^/api(?:/|$)": {
        target: apiServerUrl,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
