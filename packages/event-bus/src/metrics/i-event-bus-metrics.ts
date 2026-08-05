export interface EventBusMetricsSnapshot {
  readonly published: number;
  readonly delivered: number;
  readonly dropped: number;
  readonly retried: number;
  readonly rejected: number;
  readonly avgLatencyMs: number;
  readonly queueDepth: number;
  readonly subscriberCount: number;
}

/** Port for Event Bus Metrics (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Metrics"). */
export interface IEventBusMetrics {
  recordPublished(): void;
  recordDelivered(latencyMs: number): void;
  recordDropped(): void;
  recordRetried(): void;
  recordRejected(): void;
  setQueueDepth(depth: number): void;
  setSubscriberCount(count: number): void;
  snapshot(): EventBusMetricsSnapshot;
}
