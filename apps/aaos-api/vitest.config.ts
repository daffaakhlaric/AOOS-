import swc from "unplugin-swc";

import { withBaseConfig } from "../../configs/vitest-config/base";

/**
 * NestJS decorators (`@Controller`, `@Injectable`, `@Module`, ...) need real
 * `design:paramtypes` metadata for constructor-based dependency injection to work. Vitest
 * transforms TypeScript via esbuild (through Vite), and esbuild's `emitDecoratorMetadata`
 * support does not reliably reproduce what `tsc` emits for every constructor-injection shape
 * used across this app's controllers/services/guards (verified empirically: a minimal
 * `@Injectable` service injected into a `@Controller` resolved as `undefined` under plain
 * esbuild transform, even with `tsconfigRaw.compilerOptions.emitDecoratorMetadata: true` set).
 * `unplugin-swc` transforms `.ts` files with the real SWC/TS decorator-metadata emitter instead
 * (the same approach the NestJS docs recommend for Vitest), which resolved the DI failure. This
 * only affects the Vitest transform pipeline — the production `build` script still uses plain
 * `tsc -b`, so `dist/main.js` is always compiled by `tsc`, never by SWC.
 */
export default withBaseConfig({
  plugins: [swc.vite()],
  test: {
    setupFiles: ["./src/test-support/vitest-setup.ts"],
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.spec.ts",
        "src/**/index.ts",
        "src/main.ts",
        "src/test-support/**",
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
