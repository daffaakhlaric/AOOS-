import { describe, expect, it } from "vitest";

import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { RelationshipValidator } from "../../src/validator/relationship-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — RelationshipValidator", () => {
  it("passes for a non-blank asset id", () => {
    const asset = assetFixture();
    const result = new RelationshipValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("fails for a blank asset id", () => {
    const asset = { ...assetFixture(), id: "  " };
    const result = new RelationshipValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(false);
  });
});
