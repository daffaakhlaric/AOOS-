import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/config/workflow-execution-config.ts",
        // Pure data-shape type/interface files with zero runtime logic (no class, no
        // function) — same rationale as the `i-*.ts` exclusion above, just without that
        // naming prefix since these are plain DTOs, not behavioral Ports.
        "src/context/execution-timeouts.ts",
        "src/engine/execute-workflow-input.ts",
        "src/engine/graph-run-outcome.ts",
        "src/engine/node-step-result.ts",
        "src/transition/transition-outcome.ts",
        "src/retry/retry-state.ts",
        "src/checkpoint/execution-checkpoint.ts",
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
