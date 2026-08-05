/** "HEALTH: Healthy, Warning, Degraded, Unavailable, Unknown." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). */
export type HealthStatus = "healthy" | "warning" | "degraded" | "unavailable" | "unknown";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface KnowledgeHealthReport {
  readonly status: HealthStatus;
  readonly repository: ComponentHealth;
  readonly registry: ComponentHealth;
  readonly validation: ComponentHealth;
}
