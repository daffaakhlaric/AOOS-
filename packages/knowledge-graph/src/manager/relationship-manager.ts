import type { GraphRelationship } from "../domain/graph-relationship.js";
import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import { RelationshipService } from "../relationships/relationship-service.js";

import type { GraphSystemContext } from "./graph-system-context.js";
import type { KnowledgeGraphManager } from "./knowledge-graph-manager.js";

/**
 * Owns the relationship-centric Graph Operations: Connect, Disconnect, Relationship Exists.
 * `Connect`/`Disconnect` delegate to `KnowledgeGraphManager.createEdge`/`deleteEdge` (so they run
 * through the same 7-stage pipeline, including Relationship Validation and Cycle Detection) —
 * `RelationshipManager` is a relationship-shaped facade over that same underlying mechanism, not a
 * second, competing implementation of edge mutation.
 */
export class RelationshipManager {
  private readonly relationshipService = new RelationshipService();

  constructor(
    private readonly ctx: GraphSystemContext,
    private readonly graphManager: KnowledgeGraphManager,
  ) {}

  connect(
    graphId: string,
    sourceNodeId: string,
    targetNodeId: string,
    edgeType: KnowledgeEdgeType,
    options: { readonly weight?: number; readonly actor?: string } = {},
  ): GraphRelationship {
    const edge = this.graphManager.createEdge(
      graphId,
      { type: edgeType, sourceNodeId, targetNodeId, weight: options.weight },
      { actor: options.actor },
    );
    return this.ctx.relationshipRegistry.get(edge.id);
  }

  disconnect(graphId: string, edgeId: string, options: { readonly actor?: string } = {}): void {
    this.graphManager.deleteEdge(graphId, edgeId, options);
  }

  relationshipExists(
    graphId: string,
    sourceNodeId: string,
    targetNodeId: string,
    edgeType?: KnowledgeEdgeType,
  ): boolean {
    const engine = this.ctx.graphRegistry.get(graphId);
    return this.relationshipService.relationshipExists(
      engine,
      sourceNodeId,
      targetNodeId,
      edgeType,
    );
  }

  listRelationshipsForNode(graphId: string, nodeId: string): GraphRelationship[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    return this.relationshipService.listRelationshipsForNode(engine, nodeId);
  }

  listRelationshipsByType(graphId: string, edgeType: KnowledgeEdgeType): GraphRelationship[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    return this.relationshipService.listRelationshipsByType(engine, edgeType);
  }
}
