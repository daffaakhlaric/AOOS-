import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/config/knowledge-generator-config.ts",
        "src/domain/knowledge-generator-execution.ts",
        "src/registry/knowledge-generator-registry-entry.ts",
        "src/domain/knowledge-generation-history-entry.ts",
        "src/domain/knowledge-generation-log-entry.ts",
        "src/session/knowledge-generator-session-record.ts",
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
