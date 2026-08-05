import { generateId } from "../utils/id.js";

/** Correlation ID / Trace ID / Span Metadata (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Tracing"). */
export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly correlationId: string;
}

/** Starts a new trace (root span) for a correlation id, generating one if the caller doesn't supply it. */
export function createTraceContext(correlationId?: string): TraceContext {
  return {
    traceId: generateId(),
    spanId: generateId(),
    correlationId: correlationId ?? generateId(),
  };
}

/** Derives a child span within the same trace/correlation — used when one event causes another. */
export function createChildSpan(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: generateId(),
    parentSpanId: parent.spanId,
    correlationId: parent.correlationId,
  };
}
