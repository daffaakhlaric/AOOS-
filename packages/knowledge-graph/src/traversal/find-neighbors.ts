import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";
import type { GraphEngine } from "../graph/graph-engine.js";

export type NeighborDirection = "outgoing" | "incoming" | "both";

/** Direct (depth-1) neighbors of `nodeId`, deduplicated, optionally filtered by edge type/direction. */
export function findNeighbors(
  engine: GraphEngine,
  nodeId: string,
  direction: NeighborDirection = "both",
  edgeTypes?: readonly KnowledgeEdgeType[],
): string[] {
  if (!engine.hasNode(nodeId)) throw new NodeNotFoundException(nodeId);
  const edgeTypeSet = edgeTypes ? new Set<string>(edgeTypes) : undefined;
  const neighbors = new Set<string>();

  if (direction === "outgoing" || direction === "both") {
    for (const id of engine.outgoingNeighborIds(nodeId, edgeTypeSet)) neighbors.add(id);
  }
  if (direction === "incoming" || direction === "both") {
    for (const id of engine.incomingNeighborIds(nodeId, edgeTypeSet)) neighbors.add(id);
  }
  return Array.from(neighbors);
}
