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
        "src/domain/entities/SimulationResult.ts",
        "src/domain/events/SimulationStarted.ts",
        "src/domain/events/SimulationCompleted.ts",
        "src/domain/events/TurnCompleted.ts",
        "src/domain/events/HandoffReached.ts",
        "src/domain/events/SimulationFailed.ts",
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
