import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionCursor } from "../cursor/execution-cursor.js";

/** A point-in-time capture of an Execution Session's `ExecutionCursor` + `ExecutionContext` — the unit `ICheckpointStore` persists. */
export interface ExecutionCheckpoint {
  readonly id: string;
  readonly workflowExecutionId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly cursor: ExecutionCursor;
  readonly context: ExecutionContext;
}
