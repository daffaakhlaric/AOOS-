export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Scheduler/Clock/Queue/Trigger/Dispatcher Health (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "HEALTH"). */
export interface SchedulerHealthReport {
  readonly status: HealthStatus;
  readonly scheduler: ComponentHealth;
  readonly clock: ComponentHealth;
  readonly queue: ComponentHealth;
  readonly trigger: ComponentHealth;
  readonly dispatcher: ComponentHealth;
}
