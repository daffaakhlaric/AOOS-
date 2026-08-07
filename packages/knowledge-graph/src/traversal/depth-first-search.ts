import type { GraphTraversal } from "../domain/graph-traversal.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";
import type { GraphEngine } from "../graph/graph-engine.js";
import { highResolutionNow } from "../utils/index.js";

import type { TraversalOptions } from "./breadth-first-search.js";

/**
 * Real depth-first search over outgoing edges from `startNodeId`, implemented iteratively with an
 * explicit stack (avoids recursion depth limits on large graphs). `O(V + E)` on the reachable
 * subgraph. Visit order follows adjacency insertion order at each node.
 */
export function depthFirstSearch(
  engine: GraphEngine,
  startNodeId: string,
  options: TraversalOptions = {},
): GraphTraversal {
  if (!engine.hasNode(startNodeId)) {
    throw new NodeNotFoundException(startNodeId);
  }
  const started = highResolutionNow();
  const edgeTypeSet = options.edgeTypes ? new Set<string>(options.edgeTypes) : undefined;
  const visited = new Set<string>();
  const order: string[] = [];
  const stack: Array<{ nodeId: string; depth: number }> = [{ nodeId: startNodeId, depth: 0 }];

  while (stack.length > 0) {
    const { nodeId, depth } = stack.pop()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    order.push(nodeId);
    if (options.maxDepth !== undefined && depth >= options.maxDepth) continue;
    const neighbors = engine.outgoingNeighborIds(nodeId, edgeTypeSet);
    for (let i = neighbors.length - 1; i >= 0; i -= 1) {
      // Safe: i ranges over [0, neighbors.length), so neighbors[i] is always defined here —
      // TypeScript just can't narrow an indexed array access on its own.
      const neighborId = neighbors[i]!;
      if (!visited.has(neighborId)) {
        stack.push({ nodeId: neighborId, depth: depth + 1 });
      }
    }
  }

  return {
    algorithm: "dfs",
    startNodeId,
    visitedOrder: order,
    edgeTypes: options.edgeTypes,
    maxDepth: options.maxDepth,
    durationMs: highResolutionNow() - started,
  };
}
