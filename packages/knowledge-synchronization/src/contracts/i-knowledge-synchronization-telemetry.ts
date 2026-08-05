/** Interface only — no implementation in this package. A telemetry sink the Middleware Pipeline's Metrics step may forward samples to, independent of `KnowledgeSynchronizationMetrics`. */
export interface IKnowledgeSynchronizationTelemetry {
  record(event: string, data: Readonly<Record<string, unknown>>): void;
}
