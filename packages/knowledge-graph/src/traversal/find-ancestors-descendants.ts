import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";
import type { GraphEngine } from "../graph/graph-engine.js";

/**
 * All transitive descendants of `nodeId` (every node reachable via outgoing edges), computed with
 * an internal BFS flood-fill. Excludes `nodeId` itself. Optionally filtered to specific edge types.
 */
export function findDescendants(
  engine: GraphEngine,
  nodeId: string,
  edgeTypes?: readonly KnowledgeEdgeType[],
): string[] {
  if (!engine.hasNode(nodeId)) throw new NodeNotFoundException(nodeId);
  const edgeTypeSet = edgeTypes ? new Set<string>(edgeTypes) : undefined;
  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];
  const descendants: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighborId of engine.outgoingNeighborIds(current, edgeTypeSet)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        descendants.push(neighborId);
        queue.push(neighborId);
      }
    }
  }
  return descendants;
}

/**
 * All transitive ancestors of `nodeId` (every node that can reach it via outgoing edges),
 * computed by BFS flood-fill over the incoming-edge direction. Excludes `nodeId` itself.
 */
export function findAncestors(
  engine: GraphEngine,
  nodeId: string,
  edgeTypes?: readonly KnowledgeEdgeType[],
): string[] {
  if (!engine.hasNode(nodeId)) throw new NodeNotFoundException(nodeId);
  const edgeTypeSet = edgeTypes ? new Set<string>(edgeTypes) : undefined;
  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];
  const ancestors: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighborId of engine.incomingNeighborIds(current, edgeTypeSet)) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        ancestors.push(neighborId);
        queue.push(neighborId);
      }
    }
  }
  return ancestors;
}
