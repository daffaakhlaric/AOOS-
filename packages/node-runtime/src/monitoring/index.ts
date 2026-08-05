export type { ISpan, ITracer, SpanAttributes, TraceContext } from "@aos/event-bus";
export { InMemoryTracer, createChildSpan, createTraceContext } from "@aos/event-bus";

export * from "./node-runtime-monitor.js";
