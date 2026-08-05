/** 5 statuses, matching the vocabulary established by `@aos/knowledge-engine`/`@aos/knowledge-runtime`/`@aos/knowledge-indexing`. */
export type HealthStatus = "healthy" | "warning" | "degraded" | "unavailable" | "unknown";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface KnowledgeRetrievalHealthReport {
  readonly status: HealthStatus;
  readonly registry: ComponentHealth;
  readonly query: ComponentHealth;
}
