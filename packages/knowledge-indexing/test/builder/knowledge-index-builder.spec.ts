import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { IndexBuildException } from "../../src/errors/index-build-exception.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Builder Test — KnowledgeIndexBuilder", () => {
  it("builds a single KEYWORD entry keyed by asset id", () => {
    const asset = assetFixture({ tags: ["a", "b"] });
    const builder = new KnowledgeIndexBuilder();
    const entries = builder.build(asset, KnowledgeIndexType.KEYWORD, contextFixture(asset));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.key).toBe(asset.id);
    expect(entries[0]?.value).toEqual({ tags: ["a", "b"] });
  });

  it("builds one TAG entry per tag", () => {
    const asset = assetFixture({ tags: ["a", "b", "c"] });
    const builder = new KnowledgeIndexBuilder();
    const entries = builder.build(asset, KnowledgeIndexType.TAG, contextFixture(asset));
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.key)).toEqual(["a", "b", "c"]);
  });

  it("builds no TAG entries for an asset with no tags", () => {
    const asset = assetFixture({ tags: [] });
    const builder = new KnowledgeIndexBuilder();
    expect(builder.build(asset, KnowledgeIndexType.TAG, contextFixture(asset))).toEqual([]);
  });

  it("builds a NAMESPACE entry keyed by the Asset's namespace", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.NAMESPACE, contextFixture(asset));
    expect(entry?.key).toBe(asset.namespace);
  });

  it("builds a METADATA entry copying asset.metadata", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.METADATA, contextFixture(asset));
    expect(entry?.key).toBe("metadata");
  });

  it("builds a RELATIONSHIP entry reading relationshipCount off context.variables", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const context = contextFixture(asset, { variables: { relationships: [1, 2] } });
    const [entry] = builder.build(asset, KnowledgeIndexType.RELATIONSHIP, context);
    expect(entry?.value).toEqual({ relationshipCount: 2 });
  });

  it("builds a RELATIONSHIP entry with relationshipCount 0 when unset", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.RELATIONSHIP, contextFixture(asset));
    expect(entry?.value).toEqual({ relationshipCount: 0 });
  });

  it("builds a POLICY entry keyed by classification", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.POLICY, contextFixture(asset));
    expect(entry?.key).toBe(asset.classification);
  });

  it("builds a PERMISSION entry keyed by owner userId", () => {
    const asset = assetFixture({ ownerId: "owner-1" });
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.PERMISSION, contextFixture(asset));
    expect(entry?.key).toBe("owner-1");
  });

  it("builds a TEMPLATE entry defaulting to 'none' when unset", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.TEMPLATE, contextFixture(asset));
    expect(entry?.key).toBe("none");
  });

  it("builds a TEMPLATE entry keyed by templateId when set", () => {
    const asset = assetFixture({ templateId: "t-1" });
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.TEMPLATE, contextFixture(asset));
    expect(entry?.key).toBe("t-1");
  });

  it("builds a CATEGORY entry defaulting to 'uncategorized'", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.CATEGORY, contextFixture(asset));
    expect(entry?.key).toBe("uncategorized");
  });

  it("builds a LANGUAGE entry defaulting to 'unknown'", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.LANGUAGE, contextFixture(asset));
    expect(entry?.key).toBe("unknown");
  });

  it("builds a WORKSPACE entry keyed by scope.workspaceId", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.WORKSPACE, contextFixture(asset));
    expect(entry?.key).toBe("workspace-1");
  });

  it("builds a TENANT entry keyed by scope.tenantId", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.TENANT, contextFixture(asset));
    expect(entry?.key).toBe("tenant-1");
  });

  it("builds a DEPARTMENT entry defaulting to 'none'", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.DEPARTMENT, contextFixture(asset));
    expect(entry?.key).toBe("none");
  });

  it("builds a COLLECTION entry keyed by the namespace's library segment", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.COLLECTION, contextFixture(asset));
    expect(entry?.key).toBe("library-1");
  });

  it("builds an ASSET_TYPE entry keyed by assetType", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.ASSET_TYPE, contextFixture(asset));
    expect(entry?.key).toBe(asset.assetType);
  });

  it("builds a HYBRID_METADATA entry", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.HYBRID_METADATA, contextFixture(asset));
    expect(entry?.key).toBe("hybrid");
  });

  it("builds an EMBEDDING_REFERENCE entry from a valid context.metadata.embeddingRef", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const context = contextFixture(asset, {
      metadata: {
        embeddingRef: {
          embeddingId: "emb-1",
          provider: "openai",
          version: "1",
          model: "m",
          status: "ready",
        },
      },
    });
    const [entry] = builder.build(asset, KnowledgeIndexType.EMBEDDING_REFERENCE, context);
    expect(entry?.key).toBe("emb-1");
    expect(entry?.embeddingRef?.provider).toBe("openai");
  });

  it("throws IndexBuildException for EMBEDDING_REFERENCE with no embeddingRef supplied", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    expect(() =>
      builder.build(asset, KnowledgeIndexType.EMBEDDING_REFERENCE, contextFixture(asset)),
    ).toThrow(IndexBuildException);
  });

  it("every built entry carries id/namespace/tenantId/version/chunkRefs", () => {
    const asset = assetFixture();
    const builder = new KnowledgeIndexBuilder();
    const [entry] = builder.build(asset, KnowledgeIndexType.KEYWORD, contextFixture(asset));
    expect(entry?.id).toBeTruthy();
    expect(entry?.namespace).toBe(asset.namespace);
    expect(entry?.tenantId).toBe("tenant-1");
    expect(entry?.version).toBeDefined();
    expect(entry?.chunkRefs).toEqual([]);
  });
});
