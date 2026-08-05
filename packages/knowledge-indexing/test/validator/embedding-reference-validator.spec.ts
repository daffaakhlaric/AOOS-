import { describe, expect, it } from "vitest";

import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { EmbeddingReferenceValidator } from "../../src/validator/embedding-reference-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — EmbeddingReferenceValidator", () => {
  it("passes when embeddingRef is unset", () => {
    const asset = assetFixture();
    const result = new EmbeddingReferenceValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("passes for a valid embeddingRef", () => {
    const asset = assetFixture();
    const context = contextFixture(asset, {
      metadata: {
        embeddingRef: {
          embeddingId: "e-1",
          provider: "openai",
          version: "1",
          model: "m",
          status: "ready",
        },
      },
    });
    const result = new EmbeddingReferenceValidator().validate({
      asset,
      context,
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("fails for a malformed embeddingRef", () => {
    const asset = assetFixture();
    const context = contextFixture(asset, { metadata: { embeddingRef: { embeddingId: "e-1" } } });
    const result = new EmbeddingReferenceValidator().validate({
      asset,
      context,
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(false);
  });
});
