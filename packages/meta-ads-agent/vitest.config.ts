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
        "src/domain/events/AgentCycleStarted.ts",
        "src/domain/events/AgentCycleCompleted.ts",
        "src/domain/events/DecisionMade.ts",
        "src/domain/events/DecisionExecuted.ts",
        "src/domain/events/DecisionEscalated.ts",
        "src/domain/events/CreativeBriefGenerated.ts",
        "src/domain/events/DigestGenerated.ts",
        "src/domain/events/AgentError.ts",
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
