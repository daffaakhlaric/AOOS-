import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { IndexValidationException } from "../../src/errors/index-validation-exception.js";
import { KnowledgeIndexMetrics } from "../../src/metrics/knowledge-index-metrics.js";
import { KnowledgeIndexPipeline } from "../../src/pipeline/knowledge-index-pipeline.js";
import { KnowledgeIndexRegistryBucket } from "../../src/registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { KnowledgeIndexValidator } from "../../src/validator/knowledge-index-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

function buildPipeline(options: ConstructorParameters<typeof KnowledgeIndexPipeline>[3] = {}) {
  const registry = new KnowledgeIndexRegistry();
  const metrics = new KnowledgeIndexMetrics();
  const pipeline = new KnowledgeIndexPipeline(
    new KnowledgeIndexValidator(),
    registry,
    metrics,
    options,
  );
  return { pipeline, registry, metrics };
}

describe("Pipeline Test — KnowledgeIndexPipeline", () => {
  it("runs Validation -> Builder -> Registry -> Metrics for a valid Asset", async () => {
    const { pipeline, registry, metrics } = buildPipeline();
    const asset = assetFixture({ tags: ["a"] });
    const entries = await pipeline.run({
      asset,
      indexTypes: [KnowledgeIndexType.KEYWORD, KnowledgeIndexType.TAG],
      context: contextFixture(asset),
    });
    expect(entries).toHaveLength(2);
    expect(registry.count(KnowledgeIndexRegistryBucket.INDEX)).toBe(2);
    expect(metrics.snapshot().buildCount).toBe(1);
    expect(metrics.snapshot().tenantUsage).toEqual({ "tenant-1": 1 });
  });

  it("throws IndexValidationException and records a build failure for an invalid Asset", async () => {
    const { pipeline, metrics } = buildPipeline();
    const asset = { ...assetFixture(), namespace: "not-a-namespace" };
    await expect(
      pipeline.run({
        asset,
        indexTypes: [KnowledgeIndexType.KEYWORD],
        context: contextFixture(asset),
      }),
    ).rejects.toThrow(IndexValidationException);
    expect(metrics.snapshot().buildFailures).toBe(1);
  });

  it("passes relationships through to the Relationship Index Entry", async () => {
    const { pipeline } = buildPipeline();
    const asset = assetFixture();
    const entries = await pipeline.run({
      asset,
      indexTypes: [KnowledgeIndexType.RELATIONSHIP],
      context: contextFixture(asset),
      relationships: [{ id: "r-1" } as never, { id: "r-2" } as never],
    });
    expect(entries[0]?.value).toEqual({ relationshipCount: 2 });
  });

  it("denies indexing when the Policy checker returns false", async () => {
    const { pipeline } = buildPipeline({ policyChecker: { check: () => false } });
    const asset = assetFixture();
    await expect(
      pipeline.run({
        asset,
        indexTypes: [KnowledgeIndexType.KEYWORD],
        context: contextFixture(asset),
      }),
    ).rejects.toThrow(IndexValidationException);
  });

  it("denies indexing when the Permission checker returns false", async () => {
    const { pipeline } = buildPipeline({ permissionChecker: { check: () => false } });
    const asset = assetFixture();
    await expect(
      pipeline.run({
        asset,
        indexTypes: [KnowledgeIndexType.KEYWORD],
        context: contextFixture(asset),
      }),
    ).rejects.toThrow(IndexValidationException);
  });

  it("allows indexing when Policy/Permission checkers return true", async () => {
    const { pipeline } = buildPipeline({
      policyChecker: { check: () => true },
      permissionChecker: { check: () => true },
    });
    const asset = assetFixture();
    const entries = await pipeline.run({
      asset,
      indexTypes: [KnowledgeIndexType.KEYWORD],
      context: contextFixture(asset),
    });
    expect(entries).toHaveLength(1);
  });

  it("skips recording Workspace Usage when the Asset has no workspaceId", async () => {
    const { pipeline, metrics } = buildPipeline();
    const asset = assetFixture({ scope: { tenantId: "tenant-1" } });
    await pipeline.run({
      asset,
      indexTypes: [KnowledgeIndexType.KEYWORD],
      context: contextFixture(asset),
    });
    expect(metrics.snapshot().workspaceUsage).toEqual({});
  });
});
