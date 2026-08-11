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
        "src/domain/events/ScrapeCompleted.ts",
        "src/domain/events/ScrapeFailed.ts",
        "src/domain/events/NewUnitDetected.ts",
        "src/domain/events/UnitSoldOut.ts",
        "src/domain/events/PromoDetected.ts",
        "src/domain/events/PhotoUploaded.ts",
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
