/** "RUNTIME EVENTS" (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — the 12 named events `KnowledgeRuntimeEvents` publishes onto `@aos/event-bus`. */
export enum KnowledgeRuntimeEventType {
  CREATED = "knowledge.runtime.created",
  LOADED = "knowledge.runtime.loaded",
  READY = "knowledge.runtime.ready",
  STARTED = "knowledge.runtime.started",
  SUSPENDED = "knowledge.runtime.suspended",
  RESUMED = "knowledge.runtime.resumed",
  COMPLETED = "knowledge.runtime.completed",
  FAILED = "knowledge.runtime.failed",
  CANCELLED = "knowledge.runtime.cancelled",
  DESTROYED = "knowledge.runtime.destroyed",
  VALIDATION_FAILED = "knowledge.runtime.validation.failed",
  HEALTH_CHANGED = "knowledge.runtime.health.changed",
}
