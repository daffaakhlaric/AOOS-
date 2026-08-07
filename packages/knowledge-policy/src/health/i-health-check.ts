/** "5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown)" — the same shape used by every prior AOS Knowledge package. */
export type HealthStatus = "healthy" | "warning" | "degraded" | "unavailable" | "unknown";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface KnowledgePolicyHealthReport {
  readonly status: HealthStatus;
  readonly registry: ComponentHealth;
  readonly domain: ComponentHealth;
}
