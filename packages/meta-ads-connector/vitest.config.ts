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
        "src/types/**/*.ts",
        "src/domain/events/AdPaused.ts",
        "src/domain/events/BudgetScaled.ts",
        "src/domain/events/LeadReceived.ts",
        "src/domain/events/ObjectiveFixed.ts",
        "src/domain/events/SyncCompleted.ts",
        "src/domain/events/SyncFailed.ts",
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
