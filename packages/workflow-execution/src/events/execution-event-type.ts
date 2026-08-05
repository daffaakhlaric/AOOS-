/** "EXECUTION EVENTS: Publish through Event Bus" (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). */
export enum ExecutionEventType {
  WORKFLOW_STARTED = "workflow.execution.started",
  WORKFLOW_COMPLETED = "workflow.execution.completed",
  WORKFLOW_FAILED = "workflow.execution.failed",
  WORKFLOW_TIMEOUT = "workflow.execution.timeout",
  WORKFLOW_CANCELLED = "workflow.execution.cancelled",
  NODE_STARTED = "workflow.node.started",
  NODE_COMPLETED = "workflow.node.completed",
  NODE_FAILED = "workflow.node.failed",
  NODE_RETRY = "workflow.node.retry",
  NODE_TIMEOUT = "workflow.node.timeout",
  NODE_SKIPPED = "workflow.node.skipped",
  NODE_WAITING = "workflow.node.waiting",
}
