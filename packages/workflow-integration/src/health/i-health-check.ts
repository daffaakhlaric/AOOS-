/** "HEALTH: Healthy, Degraded, Unavailable, Unknown." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). */
export type HealthStatus = "healthy" | "degraded" | "unavailable" | "unknown";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkflowIntegrationHealthReport {
  readonly status: HealthStatus;
  readonly registry: ComponentHealth;
  readonly resolver: ComponentHealth;
  readonly adapters: Readonly<Record<string, ComponentHealth>>;
}
