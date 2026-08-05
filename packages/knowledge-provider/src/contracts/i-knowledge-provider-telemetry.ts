/** Interface only — no implementation in this package. A telemetry sink the Middleware Pipeline's Tracing step may forward samples to, independent of `KnowledgeProviderMetrics`. */
export interface IKnowledgeProviderTelemetry {
  record(event: string, data: Readonly<Record<string, unknown>>): void;
}
