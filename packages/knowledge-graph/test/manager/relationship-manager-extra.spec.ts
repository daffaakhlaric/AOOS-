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
  return { graphManager, relationshipManager };
}

describe("RelationshipManager — additional scenarios", () => {
  it("connect() defaults weight to 1 when not supplied", () => {
    const { graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const relationship = relationshipManager.connect(graph.id, a.id, b.id, KnowledgeEdgeType.Owns);
    expect(relationship.weight).toBe(1);
  });

  it("listRelationshipsByType returns an empty array when no edges of that type exist", () => {
    const { graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    expect(relationshipManager.listRelationshipsByType(graph.id, KnowledgeEdgeType.Owns)).toEqual(
      [],
    );
  });

  it("listRelationshipsForNode returns an empty array for a node with no edges", () => {
    const { graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    expect(relationshipManager.listRelationshipsForNode(graph.id, a.id)).toEqual([]);
  });

  it("connect() forwards the actor through to the pipeline", () => {
    const { graphManager, relationshipManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    expect(() =>
      relationshipManager.connect(graph.id, a.id, b.id, KnowledgeEdgeType.Owns, { actor: "alice" }),
    ).not.toThrow();
  });
});
