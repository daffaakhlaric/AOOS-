import { defineConfig } from "@playwright/test";

/**
 * Reserved Playwright configuration (TSR §3.24). No spec files exist yet — there is no
 * Dashboard/app to test in the Foundation phase (see tests/e2e/README.md). This config
 * exists so `pnpm exec playwright test` has a valid target the moment an app appears,
 * without requiring a new config file to be authored at that point.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    trace: "on-first-retry",
  },
});
