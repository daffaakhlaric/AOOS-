import type { Tracer } from "../../src/application/tracer.js";

/** A minimal fake OpenTelemetry-shaped Tracer for tests — `startActiveSpan` just invokes the callback with a stub span and returns whatever the callback returns/resolves to. */
export function createFakeTracer(): Tracer {
  return {
    startActiveSpan: (_name: string, fn: (span: { end: () => void }) => unknown) => {
      const span = { end: (): void => undefined };
      return fn(span);
    },
  } as unknown as Tracer;
}
