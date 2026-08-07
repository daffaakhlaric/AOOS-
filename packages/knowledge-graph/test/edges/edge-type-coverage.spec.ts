import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeEdgeFactory } from "../../src/edges/knowledge-edge-factory.js";

const NON_CUSTOM_TYPES = Object.values(KnowledgeEdgeType).filter(
  (type) => type !== KnowledgeEdgeType.Custom,
);

describe("KnowledgeEdgeFactory — every catalogued edge type", () => {
  const factory = new KnowledgeEdgeFactory();

  it.each(NON_CUSTOM_TYPES)("creates a %s edge without requiring customTypeLabel", (type) => {
    const edge = factory.create({ type, sourceNodeId: "A", targetNodeId: "B" });
    expect(edge.type).toBe(type);
    expect(edge.customTypeLabel).toBeUndefined();
    expect(edge.sourceNodeId).toBe("A");
    expect(edge.targetNodeId).toBe("B");
  });

  it("creates a Custom edge only when customTypeLabel is supplied", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Custom,
      customTypeLabel: "SpecialRelation",
      sourceNodeId: "A",
      targetNodeId: "B",
    });
    expect(edge.type).toBe(KnowledgeEdgeType.Custom);
    expect(edge.customTypeLabel).toBe("SpecialRelation");
  });
});
