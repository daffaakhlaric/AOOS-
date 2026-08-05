/** Every Node lifecycle change publishes one of these onto the Event Bus (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "EVENTS"). */
export enum NodeRuntimeEventType {
  CREATED = "node.created",
  INITIALIZED = "node.initialized",
  STARTED = "node.started",
  COMPLETED = "node.completed",
  FAILED = "node.failed",
  CANCELLED = "node.cancelled",
  TIMEOUT = "node.timeout",
  STATE_CHANGED = "node.state.changed",
}
