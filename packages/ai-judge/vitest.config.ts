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
        "src/domain/entities/JudgementResult.ts",
        "src/domain/entities/GoldenConversation.ts",
        "src/domain/entities/ComparisonReport.ts",
        "src/domain/entities/AllScenariosReport.ts",
        "src/domain/entities/DimensionScore.ts",
        "src/domain/events/JudgementCompleted.ts",
        "src/domain/events/GoldenConversationSaved.ts",
        "src/domain/events/VersionCompared.ts",
        "src/domain/value-objects/Feedback.ts",
        "src/domain/value-objects/ImprovementSuggestion.ts",
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
