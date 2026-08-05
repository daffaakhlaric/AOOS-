import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      // Pure type-only files (Interface First — no runtime logic) and barrel re-export files
      // are excluded from the coverage count, matching @aos/runtime-kernel's precedent
      // (docs/005.2-CORE-RUNTIME-KERNEL-REPORT.md §7): they have zero executable statements.
      // Note: contracts/base-manifest.ts (a real Zod schema) and the RegistryKind/EntryStatus/
      // TenantScope enums (real runtime objects, not erased like interfaces) are intentionally
      // NOT excluded — they have real, tested runtime code.
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        "src/interfaces/**",
        "src/entities/**",
        "src/events/registry-event.ts",
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
