import type { WorkflowExecution } from "../instance/workflow-execution.js";

export interface IWorkflowLifecycleManager {
  initialize(execution: WorkflowExecution): WorkflowExecution;
  start(execution: WorkflowExecution): WorkflowExecution;
  pause(execution: WorkflowExecution, reason?: string): WorkflowExecution;
  resume(execution: WorkflowExecution): WorkflowExecution;
  cancel(execution: WorkflowExecution, reason?: string): WorkflowExecution;
  expire(execution: WorkflowExecution): WorkflowExecution;
  complete(execution: WorkflowExecution): WorkflowExecution;
  fail(execution: WorkflowExecution, reason?: string): WorkflowExecution;
}

/**
 * "Restart (interface only)" (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md —
 * "LIFECYCLE"). No class in this package implements this — it is a declared extension
 * point for a future package that can rebuild a fresh Instance from a terminal one.
 */
export interface IRestartable {
  restart(execution: WorkflowExecution): Promise<WorkflowExecution>;
}
