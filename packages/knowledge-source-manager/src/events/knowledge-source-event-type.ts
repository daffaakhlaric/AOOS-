/** "EVENTS" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the 9 named events `KnowledgeSourceEvents` publishes onto `@aos/event-bus`. */
export enum KnowledgeSourceEventType {
  CREATED = "knowledge.source.created",
  UPDATED = "knowledge.source.updated",
  DELETED = "knowledge.source.deleted",
  ENABLED = "knowledge.source.enabled",
  DISABLED = "knowledge.source.disabled",
  REGISTERED = "knowledge.source.registered",
  ARCHIVED = "knowledge.source.archived",
  METRICS_UPDATED = "knowledge.source.metrics.updated",
  HEALTH_CHANGED = "knowledge.source.health.changed",
}
