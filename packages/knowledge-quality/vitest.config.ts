import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/config/knowledge-quality-config.ts",
        "src/domain/knowledge-quality-execution.ts",
        "src/registry/knowledge-quality-registry-entry.ts",
        "src/domain/knowledge-quality-assessment-history-entry.ts",
        "src/domain/knowledge-quality-assessment-log-entry.ts",
        "src/session/knowledge-quality-session-record.ts",
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
