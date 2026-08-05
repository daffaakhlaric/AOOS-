/** "TIMEOUT: Workflow Timeout, Node Timeout, Execution Timeout, Idle Timeout." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). All optional — omitted means "no limit". */
export interface ExecutionTimeouts {
  readonly workflowTimeoutMs?: number;
  readonly nodeTimeoutMs?: number;
  readonly executionTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
}
