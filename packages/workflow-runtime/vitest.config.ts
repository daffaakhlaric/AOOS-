import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      // Pure type-only files (Interface First — no runtime logic) follow the `i-*.ts`
      // naming convention package-wide, matching @aos/event-bus's/@aos/scheduler's/
      // @aos/workflow-definition's precedent. Barrel re-export files and pure-envelope
      // interfaces have zero executable statements too.
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/config/workflow-runtime-config.ts",
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
