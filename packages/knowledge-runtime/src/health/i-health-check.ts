/** "HEALTH: Healthy, Warning, Degraded, Unavailable, Unknown." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md). */
export type HealthStatus = "healthy" | "warning" | "degraded" | "unavailable" | "unknown";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface KnowledgeRuntimeHealthReport {
  readonly status: HealthStatus;
  readonly registry: ComponentHealth;
  readonly validation: ComponentHealth;
  readonly failureRate: ComponentHealth;
}
