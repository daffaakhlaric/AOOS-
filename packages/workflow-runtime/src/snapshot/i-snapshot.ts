import type { WorkflowContext } from "../context/workflow-context.js";
import type { WorkflowInstance } from "../instance/workflow-instance.js";

/** A point-in-time copy of an Instance's `WorkflowInstance` + `WorkflowContext` — "No persistence" (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md — "SNAPSHOT"); `SnapshotManager` only ever holds these in memory. */
export interface WorkflowSnapshot {
  readonly id: string;
  readonly instanceToken: string;
  readonly sequence: number;
  readonly capturedAt: string;
  readonly instance: WorkflowInstance;
  readonly context: WorkflowContext;
}
