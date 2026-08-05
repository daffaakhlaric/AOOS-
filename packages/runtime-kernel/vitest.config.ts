import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      // Pure type-only files (Interface First — no runtime logic) and barrel re-export
      // files are excluded from the coverage count: they have zero executable behavior,
      // so counting them against the threshold would dilute the signal for files that
      // actually have logic to verify, without this exclusion representing "untested code."
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/interfaces/**",
        "src/contracts/**",
        "src/context/execution-context.ts",
        "src/context/runtime-context.ts",
        "src/context/tenant-context.ts",
        "src/context/user-context.ts",
        "src/context/request-context.ts",
        "src/context/trace-context.ts",
        "src/events/kernel-event.ts",
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
