# @aos/testing

Shared test doubles, fixtures, and Vitest helpers used by every other AOS package's test suite.

## Contents

- `mock-logger.ts` — `createMockLogger`, a spy-based stand-in matching `@aos/logger`'s `Logger` surface (including a self-referential `child()`), so code under test can accept a `Logger` without pulling in real Pino output.
- `fixtures.ts` — `generateTestUuid`, `fixedTestDate`/`FIXED_TEST_TIMESTAMP`, `SAMPLE_TENANT_ID`, `SAMPLE_TRACE_ID` — deterministic, obviously-fake values for reproducible tests.
- `test-log-context.ts` — `buildTestLogContext`, a sensible-default `LogContext` builder for tests exercising `@aos/logger`'s context propagation.

## Dependency Graph

```
@aos/types  ──▶  @aos/common  ──▶  @aos/logger
                                        │
                                        ▼
                                 @aos/testing
```

## Architecture Note

Unlike every other Foundation package, `@aos/testing` is allowed to depend on `vitest` as a real (not dev) dependency, because it is consumed _from inside_ other packages' test files — it is testing infrastructure, not production code, and per Constitution §19 Testing Standards it must never be imported from any `src/` directory, only from `test/` directories.

## Usage

```ts
import { createMockLogger, SAMPLE_TENANT_ID } from "@aos/testing";

const logger = createMockLogger();
// ...pass `logger` into the code under test...
expect(logger.error).not.toHaveBeenCalled();
```

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
