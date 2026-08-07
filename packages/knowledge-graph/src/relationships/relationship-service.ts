import type { GraphRelationship } from "../domain/graph-relationship.js";
import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import type { GraphEngine } from "../graph/graph-engine.js";

import { toRelationship } from "./relationship-mapper.js";

/** Domain service for relationship-level queries over a `GraphEngine`'s edges. */
export class RelationshipService {
  /** True iff any edge (optionally of `edgeType`) connects `sourceNodeId` to `targetNodeId`. */
  relationshipExists(
    engine: GraphEngine,
    sourceNodeId: string,
    targetNodeId: string,
    edgeType?: KnowledgeEdgeType,
  ): boolean {
    return engine
      .outgoingEdges(sourceNodeId)
      .some(
        (edge) =>
          edge.targetNodeId === targetNodeId && (edgeType === undefined || edge.type === edgeType),
      );
  }

  listRelationshipsForNode(engine: GraphEngine, nodeId: string): GraphRelationship[] {
    return [...engine.outgoingEdges(nodeId), ...engine.incomingEdges(nodeId)].map(toRelationship);
  }

  listRelationshipsByType(engine: GraphEngine, edgeType: KnowledgeEdgeType): GraphRelationship[] {
    return engine
      .listEdges()
      .filter((edge) => edge.type === edgeType)
      .map(toRelationship);
  }
}
