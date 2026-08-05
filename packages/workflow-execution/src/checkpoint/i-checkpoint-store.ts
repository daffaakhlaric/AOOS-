import type { ExecutionCheckpoint } from "./execution-checkpoint.js";

/**
 * "CHECKPOINT: Support interface SaveCheckpoint()/LoadCheckpoint()/Resume()/Rollback().
 * Checkpoint storage MUST remain interface only." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md).
 * No class in this package implements this.
 */
export interface ICheckpointStore {
  saveCheckpoint(checkpoint: ExecutionCheckpoint): Promise<void>;
  loadCheckpoint(
    workflowExecutionId: string,
    sequence?: number,
  ): Promise<ExecutionCheckpoint | undefined>;
  resume(workflowExecutionId: string): Promise<ExecutionCheckpoint | undefined>;
  rollback(workflowExecutionId: string, toSequence: number): Promise<void>;
}
