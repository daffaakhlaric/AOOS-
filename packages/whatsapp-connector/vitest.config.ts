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
        "src/domain/events/MessageReceived.ts",
        "src/domain/events/MessageSent.ts",
        "src/domain/events/MessageDelivered.ts",
        "src/domain/events/MessageRead.ts",
        "src/domain/events/MessageFailed.ts",
        "src/domain/events/ConversationStarted.ts",
        "src/domain/events/WabaRegistered.ts",
        // Pure type alias, zero runtime code (mirrors `@aos/meta-ads-connector`'s inline `Tracer`
        // alias, which lives inside a use-case file instead and so never appears as its own
        // coverage entry) — same class of exclusion as `contracts/**` and `types/**` above.
        "src/application/tracer.ts",
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
