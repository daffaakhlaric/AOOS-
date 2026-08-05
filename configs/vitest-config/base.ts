import { defineConfig, mergeConfig, type UserConfig } from "vitest/config";

/**
 * Shared Vitest base configuration (Constitution §19 Testing Standards).
 * Package-level vitest.config.ts files merge their own overrides on top of this.
 */
export const baseVitestConfig: UserConfig = defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/index.ts"],
    },
  },
});

export function withBaseConfig(overrides: UserConfig): UserConfig {
  return mergeConfig(baseVitestConfig, overrides);
}
