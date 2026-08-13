import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/index.ts",
        "src/contracts/**/*.ts",
        "src/domain/entities/KaiAgent.ts",
        "src/domain/entities/CreativePackage.ts",
        "src/domain/entities/GenerationJob.ts",
        "src/domain/events/CreativeGenerationStarted.ts",
        "src/domain/events/CreativePackageReady.ts",
        "src/domain/events/CreativeGenerationFailed.ts",
        "src/domain/events/CopyVariantGenerated.ts",
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
