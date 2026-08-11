import type { Tracer } from "../../src/application/tracer.js";

/**
 * A minimal fake OpenTelemetry-shaped Tracer for tests — `startActiveSpan` just invokes the
 * callback with a stub span (an `end()` no-op) and returns whatever the callback returns/resolves
 * to, mirroring `@aos/meta-ads-connector`'s test helper exactly.
 */
export function createFakeTracer(): Tracer {
  return {
    startActiveSpan: (_name: string, fn: (span: { end: () => void }) => unknown) => {
      const span = { end: (): void => undefined };
      return fn(span);
    },
  } as unknown as Tracer;
}
