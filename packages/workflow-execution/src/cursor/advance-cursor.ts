import type { ExecutionCursor } from "./execution-cursor.js";

/** Returns a new `ExecutionCursor` moved onto `nextNodeId`, appending it to `visitedNodes`/`executionPath` and recording `nextNodeIds` (the full fan-out set, for Parallel Execution Mode bookkeeping). */
export function advanceCursor(
  cursor: ExecutionCursor,
  nextNodeId: string,
  allNextNodeIds: readonly string[] = [nextNodeId],
): ExecutionCursor {
  return {
    currentNodeId: nextNodeId,
    previousNodeId: cursor.currentNodeId,
    nextNodeIds: [...allNextNodeIds],
    visitedNodes: cursor.visitedNodes.includes(nextNodeId)
      ? cursor.visitedNodes
      : [...cursor.visitedNodes, nextNodeId],
    executionPath: [...cursor.executionPath, nextNodeId],
    loopIterations: { ...cursor.loopIterations },
  };
}

/** Returns a new `ExecutionCursor` with `nodeId`'s loop iteration counter incremented — `transition/transition-engine.ts` uses this to bound Loop Node re-entry. */
export function incrementLoopIteration(cursor: ExecutionCursor, nodeId: string): ExecutionCursor {
  return {
    ...cursor,
    loopIterations: {
      ...cursor.loopIterations,
      [nodeId]: (cursor.loopIterations[nodeId] ?? 0) + 1,
    },
  };
}
