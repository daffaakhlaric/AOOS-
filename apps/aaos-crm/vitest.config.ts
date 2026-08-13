import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Standalone Vitest config (mirrors `apps/aaos-dashboard/vitest.config.ts`'s documented
 * deviation from `@aos/vitest-config`'s Node-only `withBaseConfig`): this is a frontend app and
 * needs `jsdom` + `@testing-library/react` + a `tests/**\/*.test.{ts,tsx}` glob.
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
        // Every `page.tsx` in this app is a thin Server Component wrapper (a heading + one
        // `XClient`/`XForm` composition, no branching logic of its own) — the real logic lives
        // in the client components under src/components/*, which ARE covered. Same judgment call
        // `apps/aaos-dashboard`'s vitest.config.ts already makes for its own `page.tsx` files.
        "src/app/**/page.tsx",
        "src/types/crm.types.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
