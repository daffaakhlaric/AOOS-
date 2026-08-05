export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  readonly status: HealthStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** "HEALTH" (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md): Execution Queue, Running Workflow, Waiting Workflow, Dead Workflow, Checkpoint Health. */
export interface ExecutionHealthReport {
  readonly status: HealthStatus;
  readonly executionQueue: ComponentHealth;
  readonly runningWorkflow: ComponentHealth;
  readonly waitingWorkflow: ComponentHealth;
  readonly deadWorkflow: ComponentHealth;
  readonly checkpoint: ComponentHealth;
}
