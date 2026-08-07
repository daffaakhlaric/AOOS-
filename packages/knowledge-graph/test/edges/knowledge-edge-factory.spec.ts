import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeEdgeFactory } from "../../src/edges/knowledge-edge-factory.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";

describe("KnowledgeEdgeFactory", () => {
  const factory = new KnowledgeEdgeFactory();

  it("creates an edge with generated id/timestamps and default weight 1", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: "A",
      targetNodeId: "B",
    });
    expect(edge.id).toBeTruthy();
    expect(edge.weight).toBe(1);
    expect(edge.createdAt).toBe(edge.updatedAt);
  });

  it("honors a caller-supplied id/weight/metadata", () => {
    const edge = factory.create({
      id: "e1",
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: "A",
      targetNodeId: "B",
      weight: 3.5,
      metadata: { note: "x" },
    });
    expect(edge.id).toBe("e1");
    expect(edge.weight).toBe(3.5);
    expect(edge.metadata).toEqual({ note: "x" });
  });

  it("rejects a missing sourceNodeId", () => {
    expect(() =>
      factory.create({ type: KnowledgeEdgeType.Uses, sourceNodeId: "", targetNodeId: "B" }),
    ).toThrow(GraphValidationException);
  });

  it("rejects a missing targetNodeId", () => {
    expect(() =>
      factory.create({ type: KnowledgeEdgeType.Uses, sourceNodeId: "A", targetNodeId: "" }),
    ).toThrow(GraphValidationException);
  });

  it("rejects sourceNodeId === targetNodeId (self-loop)", () => {
    expect(() =>
      factory.create({ type: KnowledgeEdgeType.Uses, sourceNodeId: "A", targetNodeId: "A" }),
    ).toThrow(GraphValidationException);
  });

  it("requires customTypeLabel when type is Custom", () => {
    expect(() =>
      factory.create({ type: KnowledgeEdgeType.Custom, sourceNodeId: "A", targetNodeId: "B" }),
    ).toThrow(GraphValidationException);
  });

  it("accepts Custom type with a customTypeLabel", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Custom,
      customTypeLabel: "SpecialRelation",
      sourceNodeId: "A",
      targetNodeId: "B",
    });
    expect(edge.customTypeLabel).toBe("SpecialRelation");
  });

  it("rejects a negative weight", () => {
    expect(() =>
      factory.create({
        type: KnowledgeEdgeType.Uses,
        sourceNodeId: "A",
        targetNodeId: "B",
        weight: -1,
      }),
    ).toThrow(GraphValidationException);
  });

  it("rejects a non-finite weight", () => {
    expect(() =>
      factory.create({
        type: KnowledgeEdgeType.Uses,
        sourceNodeId: "A",
        targetNodeId: "B",
        weight: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(GraphValidationException);
  });
});
