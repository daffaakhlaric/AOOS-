import { withBaseConfig } from "../../configs/vitest-config/base";

export default withBaseConfig({
  test: {
    coverage: {
      // Pure type-only files (Interface First — no runtime logic) and barrel re-export files
      // are excluded from the coverage count, matching @aos/registry's precedent
      // (docs/005.3-REGISTRY-SYSTEM-REPORT.md §7). The 005.4 interface-only modules
      // (dead-letter, replay, store-interface) are pure interfaces with zero executable
      // statements — excluded for the same reason.
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        // Every interface-only file (Interface First — no runtime logic) follows the `i-*.ts`
        // naming convention package-wide, so one glob covers all of them (dispatcher/publisher/
        // subscriber/router/filter/serializer/tracer/health/metrics/broker/validator ports, plus
        // dead-letter/replay/store-interface's Event Sourcing readiness interfaces).
        "src/**/i-*.ts",
        "src/events/event-bus-event.ts",
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
