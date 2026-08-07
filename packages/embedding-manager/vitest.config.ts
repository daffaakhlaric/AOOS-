import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/config/embedding-manager-config.ts",
        "src/domain/embedding-execution.ts",
        "src/registry/embedding-registry-entry.ts",
        "src/domain/embedding-history-entry.ts",
        "src/domain/embedding-log-entry.ts",
        "src/session/embedding-session-record.ts",
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
