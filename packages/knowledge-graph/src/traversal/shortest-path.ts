import type { GraphPath } from "../domain/graph-path.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";
import type { GraphEngine } from "../graph/graph-engine.js";

/**
 * Real unweighted shortest path via BFS predecessor tracking (`O(V + E)`). Edge weights are
 * intentionally ignored — Dijkstra was considered but the domain has no requirement for weighted
 * shortest paths, and unweighted BFS-shortest-path is simpler, always-correct for this graph
 * shape, and matches "fewest hops" which is the meaningful notion of distance for a relationship
 * graph. Returns `undefined` when no path exists.
 */
export function shortestPath(
  engine: GraphEngine,
  startNodeId: string,
  endNodeId: string,
): GraphPath | undefined {
  if (!engine.hasNode(startNodeId)) throw new NodeNotFoundException(startNodeId);
  if (!engine.hasNode(endNodeId)) throw new NodeNotFoundException(endNodeId);

  if (startNodeId === endNodeId) {
    return { nodeIds: [startNodeId], edgeIds: [], length: 0 };
  }

  const visited = new Set<string>([startNodeId]);
  const predecessorNode = new Map<string, string>();
  const predecessorEdge = new Map<string, string>();
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of engine.outgoingEdges(current)) {
      const neighborId = edge.targetNodeId;
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      predecessorNode.set(neighborId, current);
      predecessorEdge.set(neighborId, edge.id);
      if (neighborId === endNodeId) {
        return buildPath(endNodeId, predecessorNode, predecessorEdge);
      }
      queue.push(neighborId);
    }
  }

  return undefined;
}

function buildPath(
  endNodeId: string,
  predecessorNode: ReadonlyMap<string, string>,
  predecessorEdge: ReadonlyMap<string, string>,
): GraphPath {
  const nodeIds: string[] = [endNodeId];
  const edgeIds: string[] = [];
  let cursor = endNodeId;
  while (predecessorNode.has(cursor)) {
    edgeIds.unshift(predecessorEdge.get(cursor)!);
    cursor = predecessorNode.get(cursor)!;
    nodeIds.unshift(cursor);
  }
  return { nodeIds, edgeIds, length: edgeIds.length };
}
