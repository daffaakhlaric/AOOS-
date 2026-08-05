import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        "src/config/workflow-integration-config.ts",
        // Pure data-shape type/interface files with zero runtime logic (no class, no
        // function) — same rationale as the `i-*.ts` exclusion above, just without that
        // naming prefix since these are plain DTOs, not behavioral Ports.
        "src/contracts/integration-request.ts",
        "src/contracts/integration-result.ts",
        "src/middleware/workflow-integration-middleware-context.ts",
        "src/registry/adapter-registration.ts",
        "src/retry/retry-state.ts",
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
