import type { KnowledgeEdgeType } from "./knowledge-edge-type.js";

/** A value object describing a materialized connection between two nodes via a specific edge. */
export interface GraphRelationship {
  readonly edgeId: string;
  readonly type: KnowledgeEdgeType;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly weight: number;
}
