/** "EVENTS" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the 10 named events `KnowledgeSynchronizationEvents` publishes onto `@aos/event-bus`. */
export enum KnowledgeSynchronizationEventType {
  CREATED = "knowledge.sync.created",
  STARTED = "knowledge.sync.started",
  COMPLETED = "knowledge.sync.completed",
  FAILED = "knowledge.sync.failed",
  CANCELLED = "knowledge.sync.cancelled",
  RETRY = "knowledge.sync.retry",
  VALIDATION_FAILED = "knowledge.sync.validation.failed",
  PROVIDER_RESOLVED = "knowledge.sync.provider.resolved",
  METRICS_UPDATED = "knowledge.sync.metrics.updated",
  HEALTH_CHANGED = "knowledge.sync.health.changed",
}
