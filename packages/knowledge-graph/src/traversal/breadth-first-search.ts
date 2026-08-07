import type { GraphTraversal } from "../domain/graph-traversal.js";
import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";
import type { GraphEngine } from "../graph/graph-engine.js";
import { highResolutionNow } from "../utils/index.js";

export interface TraversalOptions {
  readonly edgeTypes?: readonly KnowledgeEdgeType[];
  readonly maxDepth?: number;
}

/**
 * Real breadth-first search over outgoing edges from `startNodeId`. Visits each reachable node
 * exactly once, in BFS order (shallowest first). `O(V + E)` on the reachable subgraph.
 */
export function breadthFirstSearch(
  engine: GraphEngine,
  startNodeId: string,
  options: TraversalOptions = {},
): GraphTraversal {
  if (!engine.hasNode(startNodeId)) {
    throw new NodeNotFoundException(startNodeId);
  }
  const started = highResolutionNow();
  const edgeTypeSet = options.edgeTypes ? new Set<string>(options.edgeTypes) : undefined;
  const visited = new Set<string>([startNodeId]);
  const order: string[] = [];
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startNodeId, depth: 0 }];

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    order.push(nodeId);
    if (options.maxDepth !== undefined && depth >= options.maxDepth) continue;
    for (const neighborId of engine.outgoingNeighborIds(nodeId, edgeTypeSet)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ nodeId: neighborId, depth: depth + 1 });
      }
    }
  }

  return {
    algorithm: "bfs",
    startNodeId,
    visitedOrder: order,
    edgeTypes: options.edgeTypes,
    maxDepth: options.maxDepth,
    durationMs: highResolutionNow() - started,
  };
}
