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
        "src/domain/events/FileUploaded.ts",
        "src/domain/events/VideoGenerationStarted.ts",
        "src/domain/events/VideoGenerationCompleted.ts",
        "src/domain/events/VideoGenerationFailed.ts",
        "src/domain/events/ImageGenerationStarted.ts",
        "src/domain/events/ImageGenerationCompleted.ts",
        "src/domain/events/ImageGenerationFailed.ts",
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
