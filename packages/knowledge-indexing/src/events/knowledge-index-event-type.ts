/** "EVENTS" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — the 7 named events `KnowledgeIndexEvents` publishes onto `@aos/event-bus`. */
export enum KnowledgeIndexEventType {
  CREATED = "knowledge.index.created",
  UPDATED = "knowledge.index.updated",
  DELETED = "knowledge.index.deleted",
  REBUILT = "knowledge.index.rebuilt",
  OPTIMIZED = "knowledge.index.optimized",
  FAILED = "knowledge.index.failed",
  HEALTH_CHANGED = "knowledge.index.health.changed",
}
