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
        "src/application/tracer.ts",
        "src/domain/events/ConversationStarted.ts",
        "src/domain/events/MessageProcessed.ts",
        "src/domain/events/LeadScoreUpdated.ts",
        "src/domain/events/LeadBecameHot.ts",
        "src/domain/events/HandoffTriggered.ts",
        "src/domain/events/FollowUpScheduled.ts",
        "src/domain/events/ConversationClosed.ts",
        "src/domain/events/PropertyLeadScoreUpdated.ts",
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
