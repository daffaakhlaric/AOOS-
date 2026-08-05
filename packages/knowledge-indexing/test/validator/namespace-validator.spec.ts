import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { NamespaceValidator } from "../../src/validator/namespace-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — NamespaceValidator", () => {
  it("passes for a valid namespace", () => {
    const asset = assetFixture();
    const result = new NamespaceValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(result.valid).toBe(true);
  });

  it("fails for a malformed namespace", () => {
    const asset = { ...assetFixture(), namespace: "not-a-namespace" };
    const result = new NamespaceValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [KnowledgeIndexType.KEYWORD],
    });
    expect(result.valid).toBe(false);
  });
});
