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
        "src/infrastructure/supabase/SupabaseTypes.ts",
        "src/domain/events/LeadCreated.ts",
        "src/domain/events/LeadStatusChanged.ts",
        "src/domain/events/LeadAssigned.ts",
        "src/domain/events/LeadBecameHot.ts",
        "src/domain/events/ConversationUpdated.ts",
        "src/domain/events/ClosingRecorded.ts",
        "src/domain/events/ScoreUpdated.ts",
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
