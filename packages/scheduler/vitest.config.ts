import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      // Pure type-only files (Interface First — no runtime logic) follow the `i-*.ts`
      // naming convention package-wide, matching @aos/event-bus's precedent
      // (docs/005.4-EVENT-BUS-REPORT.md). Barrel re-export files, entities/ (pure
      // envelope interfaces, matching @aos/registry's precedent), and config/
      // (a pure options interface) have zero executable statements too.
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/entities/**",
        "src/config/scheduler-config.ts",
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
