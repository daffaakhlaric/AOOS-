export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Publisher/Subscriber/Dispatcher/Router/Broker Health (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Health"). */
export interface EventBusHealthReport {
  readonly status: HealthStatus;
  readonly publisher: ComponentHealth;
  readonly subscriber: ComponentHealth;
  readonly dispatcher: ComponentHealth;
  readonly router: ComponentHealth;
  readonly broker: ComponentHealth;
}
