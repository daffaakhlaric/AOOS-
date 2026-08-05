/** Interface only — no implementation in this package. A distributed-tracing backend the Middleware Pipeline's Tracing step may delegate to. */
export interface IKnowledgeSynchronizationTracer {
  startSpan(name: string, traceId?: string): void;
  endSpan(name: string): void;
}
