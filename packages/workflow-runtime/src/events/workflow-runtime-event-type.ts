/** Every Workflow Instance lifecycle change publishes one of these onto the Event Bus (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md — "EVENTS"). */
export enum WorkflowRuntimeEventType {
  CREATED = "workflow.instance.created",
  INITIALIZED = "workflow.instance.initialized",
  STARTED = "workflow.instance.started",
  PAUSED = "workflow.instance.paused",
  RESUMED = "workflow.instance.resumed",
  COMPLETED = "workflow.instance.completed",
  FAILED = "workflow.instance.failed",
  CANCELLED = "workflow.instance.cancelled",
  EXPIRED = "workflow.instance.expired",
  SNAPSHOT_CREATED = "workflow.instance.snapshot.created",
  STATE_CHANGED = "workflow.instance.state.changed",
}
