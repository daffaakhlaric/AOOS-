import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/config/knowledge-validator-config.ts",
        "src/domain/knowledge-validation-execution.ts",
        "src/registry/knowledge-validator-registry-entry.ts",
        "src/domain/knowledge-validation-history-entry.ts",
        "src/domain/knowledge-validation-log-entry.ts",
        "src/session/knowledge-validator-session-record.ts",
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
