// OpenTelemetry-ready Tracing (Trace ID/Correlation ID/Span) is reused directly from
// @aos/event-bus rather than reimplemented — see broker/scheduler.ts for how it's wired
// into dispatch. Re-exported here so consumers of this module get the same port.
export type { ISpan, ITracer, SpanAttributes, TraceContext } from "@aos/event-bus";
export { createChildSpan, createTraceContext, InMemoryTracer } from "@aos/event-bus";

export * from "./scheduler-monitor.js";
