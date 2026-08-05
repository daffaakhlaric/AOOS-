import type { ExecutionCursor } from "./execution-cursor.js";

/** Builds a fresh `ExecutionCursor` positioned at `startNodeId`, with empty history. */
export function createExecutionCursor(startNodeId: string): ExecutionCursor {
  return {
    currentNodeId: startNodeId,
    previousNodeId: undefined,
    nextNodeIds: [],
    visitedNodes: [startNodeId],
    executionPath: [startNodeId],
    loopIterations: {},
  };
}
