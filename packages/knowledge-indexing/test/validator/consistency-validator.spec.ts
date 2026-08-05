import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexRegistryBucket } from "../../src/registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { ConsistencyValidator } from "../../src/validator/consistency-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — ConsistencyValidator", () => {
  it("passes when no existing Index Entries reference the Asset", () => {
    const asset = assetFixture();
    const result = new ConsistencyValidator().validate({
      asset,
      context: contextFixture(asset),
      registry: new KnowledgeIndexRegistry(),
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("passes when an existing Entry's namespace agrees with the Asset's current namespace", () => {
    const asset = assetFixture();
    const registry = new KnowledgeIndexRegistry();
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.KEYWORD,
      contextFixture(asset),
    );
    registry.register(KnowledgeIndexRegistryBucket.INDEX, entry!);
    const result = new ConsistencyValidator().validate({
      asset,
      context: contextFixture(asset),
      registry,
      indexTypes: [],
    });
    expect(result.valid).toBe(true);
  });

  it("fails when an existing Entry's namespace disagrees with the Asset's current namespace", () => {
    const asset = assetFixture();
    const registry = new KnowledgeIndexRegistry();
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.KEYWORD,
      contextFixture(asset),
    );
    registry.register(KnowledgeIndexRegistryBucket.INDEX, entry!);
    const movedAsset = { ...asset, namespace: "knowledge://tenant-1/workspace-1/library-2/doc-1" };
    const result = new ConsistencyValidator().validate({
      asset: movedAsset,
      context: contextFixture(movedAsset),
      registry,
      indexTypes: [],
    });
    expect(result.valid).toBe(false);
  });
});
