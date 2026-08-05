/** "HEALTH: Healthy, Warning, Degraded, Unavailable, Unknown." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the exact 5 statuses from the prompt. */
export type HealthStatus = "healthy" | "warning" | "degraded" | "unavailable" | "unknown";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface KnowledgeSourceHealthReport {
  readonly status: HealthStatus;
  readonly registry: ComponentHealth;
  readonly catalog: ComponentHealth;
}
