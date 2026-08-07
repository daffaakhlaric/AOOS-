import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/**/i-*.ts",
        // Pure type/interface files (no runtime code — every export is `interface`/`type`, so
        // there is nothing for V8 to execute; they are still real, load-bearing contracts,
        // exercised indirectly through the factories/services that construct these shapes).
        "src/types/**",
        "src/pipeline/pipeline-stage.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 95,
        functions: 100,
        lines: 100,
      },
    },
  },
});
