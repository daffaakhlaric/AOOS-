/** Distributed-tracing identifiers, mirroring the Event/Logging Contract fields (docs/003.5-CONTRACT-FIRST-DESIGN.md). */
export interface TraceContext {
  readonly traceId: string;
  readonly correlationId?: string;
  readonly spanId?: string;
}
