import type { InstanceState } from "../instance/instance-state.js";

export interface WorkflowRuntimeMetricsSnapshot {
  readonly runningWorkflows: number;
  readonly completedWorkflows: number;
  readonly failedWorkflows: number;
  readonly averageRuntimeMs: number;
  readonly currentStateCount: Readonly<Record<InstanceState, number>>;
  readonly averageExecutionLatencyMs: Readonly<Record<string, number>>;
}

/** "METRICS" (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md): Running/Completed/Failed Workflows, Average Runtime, Current State Count, Execution Latency. */
export interface IWorkflowRuntimeMetrics {
  recordInstanceCreated(): void;
  recordInstanceCompleted(runtimeMs: number): void;
  recordInstanceFailed(): void;
  /** Maintains the `currentStateCount` gauge: decrements `from` (when supplied), increments `to`. */
  recordStateChange(to: InstanceState, from?: InstanceState): void;
  recordExecutionLatency(operation: string, ms: number): void;
  snapshot(): WorkflowRuntimeMetricsSnapshot;
}
