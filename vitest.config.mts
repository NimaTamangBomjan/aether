import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        resolve: { alias: { "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") } },
        test: { name: "ai-live", include: ["tests/ai-live/**/*.test.ts"], environment: "node", testTimeout: 60_000 },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
}));
