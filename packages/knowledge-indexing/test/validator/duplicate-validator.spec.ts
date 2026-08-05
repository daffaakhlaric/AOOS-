import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { DuplicateValidator } from "../../src/validator/duplicate-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — DuplicateValidator", () => {
  it("passes for a unique indexTypes list", () => {
    const asset = assetFixture();
    const result = new DuplicateValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [KnowledgeIndexType.KEYWORD, KnowledgeIndexType.TAG],
    });
    expect(result.valid).toBe(true);
  });

  it("fails for a repeated indexTypes entry", () => {
    const asset = assetFixture();
    const result = new DuplicateValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [KnowledgeIndexType.KEYWORD, KnowledgeIndexType.KEYWORD],
    });
    expect(result.valid).toBe(false);
  });
});
