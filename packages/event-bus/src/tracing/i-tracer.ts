import type { TraceContext } from "./trace-context.js";

export interface SpanAttributes {
  readonly [key: string]: string | number | boolean;
}

export interface ISpan {
  readonly context: TraceContext;
  setAttribute(key: string, value: string | number | boolean): void;
  end(attributes?: SpanAttributes): void;
}

/**
 * Tracer port — "OpenTelemetry ready" (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md). Shaped so
 * a real `@opentelemetry/api` `Tracer` can be adapted to this interface without changing any
 * Dispatcher/Publisher/Subscriber call site; no OTel dependency is added in this Engineering
 * Task — `InMemoryTracer` (in-memory-tracer.ts) is the only shipped implementation.
 */
export interface ITracer {
  startSpan(name: string, context: TraceContext, attributes?: SpanAttributes): ISpan;
}
