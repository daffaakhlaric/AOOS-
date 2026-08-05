import type { WorkflowDefinition } from "@aos/workflow-definition";

import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionCursor } from "../cursor/execution-cursor.js";
import type { ExecutionHistory } from "../result/execution-history.js";
import type { ExecutionStatistics } from "../result/execution-statistics.js";

/**
 * The live, in-memory aggregate `WorkflowExecutionEngine` operates on — the
 * `WorkflowDefinition` being executed (read-only, never mutated here), its
 * `ExecutionContext` (token/mode/variables/state), its `ExecutionCursor` (graph
 * position), the ordered `ExecutionHistory` of every State transition, and running
 * `ExecutionStatistics`.
 */
export interface ExecutionSession {
  readonly definition: WorkflowDefinition;
  readonly context: ExecutionContext;
  readonly cursor: ExecutionCursor;
  readonly history: ExecutionHistory;
  readonly statistics: ExecutionStatistics;
}

/** Returns a new `ExecutionSession` with the given fields replaced. */
export function withSessionState(
  session: ExecutionSession,
  patch: Partial<Omit<ExecutionSession, "definition">>,
): ExecutionSession {
  return {
    definition: session.definition,
    context: patch.context ?? session.context,
    cursor: patch.cursor ?? session.cursor,
    history: patch.history ?? session.history,
    statistics: patch.statistics ?? session.statistics,
  };
}
