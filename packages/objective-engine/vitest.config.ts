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
        "src/domain/events/ObjectiveCreated.ts",
        "src/domain/events/ObjectiveUpdated.ts",
        "src/domain/events/ObjectiveCompleted.ts",
        "src/domain/events/ProgressUpdated.ts",
        "src/domain/events/ObjectiveOffTrack.ts",
        "src/domain/events/RecommendationGenerated.ts",
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
