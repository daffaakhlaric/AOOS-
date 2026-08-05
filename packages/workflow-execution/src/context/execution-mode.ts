/** "SUPPORTED EXECUTION MODES" (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). */
export enum ExecutionMode {
  SEQUENTIAL = "sequential",
  PARALLEL = "parallel",
  CONDITIONAL = "conditional",
  LOOP = "loop",
  WAIT = "wait",
  EVENT_DRIVEN = "event_driven",
  SCHEDULED = "scheduled",
  MANUAL_APPROVAL = "manual_approval",
  COMPENSATION = "compensation",
  RETRY = "retry",
}
