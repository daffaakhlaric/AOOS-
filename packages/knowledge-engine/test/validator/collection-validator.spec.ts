import { describe, expect, it } from "vitest";

import { KnowledgeRepository } from "../../src/repository/knowledge-repository.js";
import { CollectionValidator } from "../../src/validator/collection-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — CollectionValidator", () => {
  it("passes when no collection is supplied", () => {
    expect(new CollectionValidator().validate({}).valid).toBe(true);
  });

  it("passes when every assetId resolves in the Repository", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    const result = new CollectionValidator().validate({
      repository,
      collection: {
        id: "c-1",
        name: "x",
        scope: { tenantId: "t1" },
        assetIds: [asset.id],
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a dangling assetId", () => {
    const repository = new KnowledgeRepository();
    const result = new CollectionValidator().validate({
      repository,
      collection: {
        id: "c-1",
        name: "x",
        scope: { tenantId: "t1" },
        assetIds: ["ghost"],
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(false);
  });
});
