export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** "HEALTH" (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md): Runtime, Registry, Factory, Validator, Resolver. */
export interface NodeRuntimeHealthReport {
  readonly status: HealthStatus;
  readonly runtime: ComponentHealth;
  readonly registry: ComponentHealth;
  readonly factory: ComponentHealth;
  readonly validator: ComponentHealth;
  readonly resolver: ComponentHealth;
}
