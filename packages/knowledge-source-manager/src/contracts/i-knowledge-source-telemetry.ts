/** Interface only — no implementation in this package. A caller-supplied telemetry sink the Middleware Pipeline's Tracing/Logging slots may forward to. */
export interface IKnowledgeSourceTelemetry {
  record(eventName: string, attributes: Readonly<Record<string, unknown>>): void;
}
