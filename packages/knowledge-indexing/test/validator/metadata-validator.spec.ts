import { describe, expect, it } from "vitest";

import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — MetadataValidator", () => {
  it("passes for unique tags/labels", () => {
    const asset = assetFixture({ tags: ["a", "b"], labels: ["x"] });
    const result = new MetadataValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("fails for duplicate tags", () => {
    const asset = assetFixture({ tags: ["a", "a"] });
    const result = new MetadataValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(false);
  });

  it("fails for duplicate labels", () => {
    const asset = assetFixture({ labels: ["x", "x"] });
    const result = new MetadataValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(false);
  });
});
