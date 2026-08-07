import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { toRelationship } from "../../src/relationships/relationship-mapper.js";
import { RelationshipService } from "../../src/relationships/relationship-service.js";
import { addEdge, buildDagEngine } from "../helpers/graph-fixtures.js";

describe("toRelationship", () => {
  it("projects a KnowledgeEdge into a GraphRelationship view", () => {
    const engine = buildDagEngine();
    const edge = engine.getEdge("DependsOn:A->B");
    expect(toRelationship(edge)).toEqual({
      edgeId: edge.id,
      type: edge.type,
      sourceNodeId: "A",
      targetNodeId: "B",
      weight: 1,
    });
  });
});

describe("RelationshipService", () => {
  const service = new RelationshipService();

  it("relationshipExists is true for a directly connected pair", () => {
    const engine = buildDagEngine();
    expect(service.relationshipExists(engine, "A", "B")).toBe(true);
  });

  it("relationshipExists is false for an unconnected pair", () => {
    const engine = buildDagEngine();
    expect(service.relationshipExists(engine, "B", "D")).toBe(false);
  });

  it("relationshipExists filters by edge type when supplied", () => {
    const engine = buildDagEngine();
    addEdge(engine, "A", "B", KnowledgeEdgeType.RelatedTo);
    expect(service.relationshipExists(engine, "A", "B", KnowledgeEdgeType.DependsOn)).toBe(true);
    expect(service.relationshipExists(engine, "A", "B", KnowledgeEdgeType.Owns)).toBe(false);
  });

  it("listRelationshipsForNode returns both outgoing and incoming relationships", () => {
    const engine = buildDagEngine();
    const relationships = service.listRelationshipsForNode(engine, "C");
    // C has incoming from B and A, and outgoing to D.
    expect(relationships.length).toBe(3);
  });

  it("listRelationshipsByType filters across the whole graph", () => {
    const engine = buildDagEngine();
    addEdge(engine, "B", "D", KnowledgeEdgeType.RelatedTo);
    const related = service.listRelationshipsByType(engine, KnowledgeEdgeType.RelatedTo);
    expect(related).toHaveLength(1);
    expect(related[0]?.sourceNodeId).toBe("B");
  });
});
