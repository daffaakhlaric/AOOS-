import { describe, expect, it } from "vitest";

import { KnowledgeRelationshipType } from "../../src/domain/knowledge-relationship-type.js";
import { InvalidRelationshipException } from "../../src/errors/invalid-relationship-exception.js";
import { RelationshipFactory } from "../../src/factory/relationship-factory.js";

describe("Factory Test — RelationshipFactory", () => {
  it("creates a Relationship with a generated id and timestamp", () => {
    const relationship = new RelationshipFactory().create({
      fromAssetId: "a-1",
      toAssetId: "a-2",
      type: KnowledgeRelationshipType.RELATED,
    });
    expect(relationship.id).toEqual(expect.any(String));
    expect(relationship.fromAssetId).toBe("a-1");
    expect(relationship.toAssetId).toBe("a-2");
    expect(relationship.createdAt).toEqual(expect.any(String));
  });

  it("throws InvalidRelationshipException for a self-referencing edge", () => {
    expect(() =>
      new RelationshipFactory().create({
        fromAssetId: "a-1",
        toAssetId: "a-1",
        type: KnowledgeRelationshipType.RELATED,
      }),
    ).toThrow(InvalidRelationshipException);
  });

  it("carries through optional metadata", () => {
    const relationship = new RelationshipFactory().create({
      fromAssetId: "a-1",
      toAssetId: "a-2",
      type: KnowledgeRelationshipType.USES,
      metadata: { weight: 1 },
    });
    expect(relationship.metadata).toEqual({ weight: 1 });
  });
});
