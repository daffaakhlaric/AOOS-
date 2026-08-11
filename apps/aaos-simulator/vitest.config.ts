import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Standalone Vitest config for this app, not `@aos/vitest-config`'s `withBaseConfig` (documented
 * deviation): the shared base config targets Node-only backend packages — `environment: "node"`,
 * `include: ["test/**\/*.spec.ts"]`, no React plugin/jsdom. This is the first frontend app in the
 * monorepo and needs `jsdom` + `@testing-library/react` + a `tests/**\/*.test.{ts,tsx}` glob, none
 * of which the shared config provides.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/app/layout.tsx",
        "src/app/**/loading.tsx",
        // Pure type/interface declarations — no executable statements of their own to cover.
        "src/types/simulator.types.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
