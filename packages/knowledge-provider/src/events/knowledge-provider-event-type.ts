/** "EVENTS" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — the 9 named events `KnowledgeProviderEvents` publishes onto `@aos/event-bus`. */
export enum KnowledgeProviderEventType {
  REGISTERED = "knowledge.provider.registered",
  UPDATED = "knowledge.provider.updated",
  ENABLED = "knowledge.provider.enabled",
  DISABLED = "knowledge.provider.disabled",
  CONNECTED = "knowledge.provider.connected",
  DISCONNECTED = "knowledge.provider.disconnected",
  FAILED = "knowledge.provider.failed",
  METRICS_UPDATED = "knowledge.provider.metrics.updated",
  HEALTH_CHANGED = "knowledge.provider.health.changed",
}
