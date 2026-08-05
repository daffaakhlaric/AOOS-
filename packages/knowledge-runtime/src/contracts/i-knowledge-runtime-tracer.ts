/** Interface only — no implementation in this package. `TracingMiddleware` uses `@aos/event-bus`'s `ITracer` by default; a future consumer may supply a Knowledge-Runtime-specific tracer implementing this instead. */
export interface IKnowledgeRuntimeTracer {
  startSpan(name: string, attributes?: Readonly<Record<string, unknown>>): string;
  endSpan(spanId: string, attributes?: Readonly<Record<string, unknown>>): void;
}
