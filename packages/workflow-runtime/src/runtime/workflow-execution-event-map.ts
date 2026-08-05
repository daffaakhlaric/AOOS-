import { WorkflowRuntimeEventType } from "../events/workflow-runtime-event-type.js";

/** Maps each Lifecycle operation to the `WorkflowRuntimeEventType` `runtime/workflow-runtime.ts` publishes alongside it. */
export const WorkflowExecutionEventMap = {
  initialize: WorkflowRuntimeEventType.INITIALIZED,
  start: WorkflowRuntimeEventType.STARTED,
  pause: WorkflowRuntimeEventType.PAUSED,
  resume: WorkflowRuntimeEventType.RESUMED,
  cancel: WorkflowRuntimeEventType.CANCELLED,
  expire: WorkflowRuntimeEventType.EXPIRED,
  complete: WorkflowRuntimeEventType.COMPLETED,
  fail: WorkflowRuntimeEventType.FAILED,
} as const;
