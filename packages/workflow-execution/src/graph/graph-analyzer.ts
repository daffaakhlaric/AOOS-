import type { ExecutionGraph } from "./execution-graph.js";

/** "Detect cycles." DFS-based cycle detection returning every distinct cycle found, as an ordered list of Node ids. */
export function detectCycles(graph: ExecutionGraph): readonly (readonly string[])[] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function visit(nodeId: string): void {
    visited.add(nodeId);
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const edge of graph.edgesByFromNode.get(nodeId) ?? []) {
      if (!visited.has(edge.toNodeId)) {
        visit(edge.toNodeId);
      } else if (onStack.has(edge.toNodeId)) {
        const cycleStart = stack.indexOf(edge.toNodeId);
        cycles.push(stack.slice(cycleStart));
      }
    }

    stack.pop();
    onStack.delete(nodeId);
  }

  for (const nodeId of graph.nodeIds) {
    if (!visited.has(nodeId)) {
      visit(nodeId);
    }
  }

  return cycles;
}

/** "Detect dead end." Every non-End Node with zero outgoing edges. */
export function detectDeadEnds(graph: ExecutionGraph): readonly string[] {
  return graph.nodeIds.filter(
    (nodeId) =>
      !graph.endNodeIds.has(nodeId) && (graph.edgesByFromNode.get(nodeId) ?? []).length === 0,
  );
}

/** "Detect orphan nodes." Every non-Start Node with zero incoming edges. */
export function detectOrphanNodes(graph: ExecutionGraph): readonly string[] {
  return graph.nodeIds.filter(
    (nodeId) =>
      nodeId !== graph.startNodeId && (graph.edgesByToNode.get(nodeId) ?? []).length === 0,
  );
}

/**
 * "Detect infinite loop." A cycle that does not pass through a declared Loop Node is
 * unintended — a real Loop Node's structural `bodyNodeId` edge is the only sanctioned
 * cycle shape.
 */
export function detectInfiniteLoopRisks(graph: ExecutionGraph): readonly (readonly string[])[] {
  return detectCycles(graph).filter(
    (cycle) => !cycle.some((nodeId) => graph.loopNodeIds.has(nodeId)),
  );
}
