import { describe, expect, it } from "vitest";

import { KnowledgeRelationshipType } from "../../src/domain/knowledge-relationship-type.js";
import { KnowledgeRepository } from "../../src/repository/knowledge-repository.js";
import { RelationshipValidator } from "../../src/validator/relationship-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — RelationshipValidator", () => {
  it("passes when no relationship is supplied", () => {
    expect(new RelationshipValidator().validate({}).valid).toBe(true);
  });

  it("flags a self-referencing edge", () => {
    const result = new RelationshipValidator().validate({
      relationship: {
        id: "r-1",
        fromAssetId: "a-1",
        toAssetId: "a-1",
        type: KnowledgeRelationshipType.RELATED,
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a dangling reference when a Repository is supplied", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    const result = new RelationshipValidator().validate({
      repository,
      relationship: {
        id: "r-1",
        fromAssetId: asset.id,
        toAssetId: "ghost",
        type: KnowledgeRelationshipType.RELATED,
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("relationship.toAssetId");
  });

  it("passes when both endpoints resolve in the Repository", () => {
    const repository = new KnowledgeRepository();
    const a = assetFixture({ id: "a-1" });
    const b = assetFixture({ id: "a-2" });
    repository.save(a);
    repository.save(b);
    const result = new RelationshipValidator().validate({
      repository,
      relationship: {
        id: "r-1",
        fromAssetId: a.id,
        toAssetId: b.id,
        type: KnowledgeRelationshipType.RELATED,
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(true);
  });
});
