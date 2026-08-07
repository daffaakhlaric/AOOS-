import type { GraphRelationship } from "../domain/graph-relationship.js";
import type { KnowledgeEdge } from "../domain/knowledge-edge.js";

/** Projects a `KnowledgeEdge` into its `GraphRelationship` value-object view. */
export function toRelationship(edge: KnowledgeEdge): GraphRelationship {
  return {
    edgeId: edge.id,
    type: edge.type,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    weight: edge.weight,
  };
}
