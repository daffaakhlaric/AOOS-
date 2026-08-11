import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/index.ts",
        "src/contracts/**/*.ts",
        "src/application/tracer.ts",
        // Pure payload-shape interfaces, zero runtime code — mirrors
        // `@aos/dss-inventory-connector`'s identical event-file exclusion pattern.
        "src/domain/events/LeadAssigned.ts",
        "src/domain/events/LeadQueued.ts",
        "src/domain/events/SalesStatusChanged.ts",
        "src/domain/events/BranchConfigUpdated.ts",
        "src/domain/events/QueueFlushed.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 95,
        functions: 100,
        lines: 100,
      },
    },
  },
});
