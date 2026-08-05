export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** "HEALTH" (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md): Runtime/Loader/Validator/State Machine/Context Health. */
export interface WorkflowRuntimeHealthReport {
  readonly status: HealthStatus;
  readonly runtime: ComponentHealth;
  readonly loader: ComponentHealth;
  readonly validator: ComponentHealth;
  readonly stateMachine: ComponentHealth;
  readonly context: ComponentHealth;
}
