/** 5 statuses, matching the vocabulary established by prior Knowledge packages. */
export type HealthStatus = "healthy" | "warning" | "degraded" | "unavailable" | "unknown";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface KnowledgeProviderHealthReport {
  readonly status: HealthStatus;
  readonly registry: ComponentHealth;
  readonly provider: ComponentHealth;
}
