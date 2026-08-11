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
        "src/types/**/*.ts",
        // Pure type alias, zero runtime code — mirrors `@aos/whatsapp-connector`'s identical
        // `application/tracer.ts` exclusion.
        "src/application/tracer.ts",
        "src/domain/events/SyncCompleted.ts",
        "src/domain/events/SyncFailed.ts",
        "src/domain/events/UnitAdded.ts",
        "src/domain/events/UnitUpdated.ts",
        "src/domain/events/UnitSold.ts",
        "src/domain/events/UnitReserved.ts",
        "src/domain/events/InventoryChanged.ts",
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
