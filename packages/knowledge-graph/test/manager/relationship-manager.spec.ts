import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { RelationshipManager } from "../../src/manager/relationship-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const graphManager = new KnowledgeGraphManager(ctx);
  const relationshipManager = new RelationshipManager(ctx, graphManager);
  return { ctx, graphManager, relationshipManager };
}

describe("RelationshipManager", () => {
  it("connect() creates an edge through the pipeline and returns the relationship view", () => {
    const { graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const relationship = relationshipManager.connect(graph.id, a.id, b.id, KnowledgeEdgeType.Uses, {
      weight: 3,
    });
    expect(relationship.sourceNodeId).toBe(a.id);
    expect(relationship.targetNodeId).toBe(b.id);
    expect(relationship.weight).toBe(3);
  });

  it("disconnect() removes the edge via KnowledgeGraphManager.deleteEdge", () => {
    const { ctx, graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const relationship = relationshipManager.connect(graph.id, a.id, b.id, KnowledgeEdgeType.Uses);
    relationshipManager.disconnect(graph.id, relationship.edgeId);
    expect(ctx.edgeRegistry.has(relationship.edgeId)).toBe(false);
  });

  it("relationshipExists is true after connect and false after disconnect", () => {
    const { graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    expect(relationshipManager.relationshipExists(graph.id, a.id, b.id)).toBe(false);
    const relationship = relationshipManager.connect(graph.id, a.id, b.id, KnowledgeEdgeType.Uses);
    expect(relationshipManager.relationshipExists(graph.id, a.id, b.id)).toBe(true);
    expect(
      relationshipManager.relationshipExists(graph.id, a.id, b.id, KnowledgeEdgeType.Owns),
    ).toBe(false);
    relationshipManager.disconnect(graph.id, relationship.edgeId);
    expect(relationshipManager.relationshipExists(graph.id, a.id, b.id)).toBe(false);
  });

  it("listRelationshipsForNode/listRelationshipsByType delegate to RelationshipService", () => {
    const { graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    relationshipManager.connect(graph.id, a.id, b.id, KnowledgeEdgeType.Uses);
    expect(relationshipManager.listRelationshipsForNode(graph.id, a.id)).toHaveLength(1);
    expect(
      relationshipManager.listRelationshipsByType(graph.id, KnowledgeEdgeType.Uses),
    ).toHaveLength(1);
  });
});
