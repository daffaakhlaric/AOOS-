/** "EVENTS" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the 8 named events `KnowledgeRetrievalEvents` publishes onto `@aos/event-bus`. */
export enum KnowledgeRetrievalEventType {
  SEARCH_STARTED = "knowledge.search.started",
  SEARCH_COMPLETED = "knowledge.search.completed",
  SEARCH_FAILED = "knowledge.search.failed",
  SEARCH_FILTERED = "knowledge.search.filtered",
  SEARCH_RANKED = "knowledge.search.ranked",
  SEARCH_CANCELLED = "knowledge.search.cancelled",
  HEALTH_CHANGED = "knowledge.search.health.changed",
  METRICS_UPDATED = "knowledge.search.metrics.updated",
}
