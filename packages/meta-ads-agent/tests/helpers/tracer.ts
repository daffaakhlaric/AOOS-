import type { Tracer } from "../../src/application/use-cases/RunOptimizationCycle.js";

/**
 * A minimal fake OpenTelemetry-shaped Tracer for tests — `startActiveSpan` just invokes the
 * callback with a stub span (an `end()` no-op) and returns whatever the callback returns/resolves
 * to. Mirrors `@aos/objective-engine`'s / `@aos/meta-ads-connector`'s `createFakeTracer`.
 */
export function createFakeTracer(): Tracer {
  return {
    startActiveSpan: (_name: string, fn: (span: { end: () => void }) => unknown) => {
      const span = { end: (): void => undefined };
      return fn(span);
    },
  } as unknown as Tracer;
}
