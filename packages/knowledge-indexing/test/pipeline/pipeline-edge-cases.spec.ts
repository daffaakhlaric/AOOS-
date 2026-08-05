import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexMetrics } from "../../src/metrics/knowledge-index-metrics.js";
import { KnowledgeIndexPipeline } from "../../src/pipeline/knowledge-index-pipeline.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { KnowledgeIndexValidator } from "../../src/validator/knowledge-index-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Pipeline Test — edge cases", () => {
  it("builds entries across multiple requested indexTypes in one run() call", async () => {
    const registry = new KnowledgeIndexRegistry();
    const metrics = new KnowledgeIndexMetrics();
    const pipeline = new KnowledgeIndexPipeline(new KnowledgeIndexValidator(), registry, metrics);
    const asset = assetFixture();
    const entries = await pipeline.run({
      asset,
      indexTypes: [
        KnowledgeIndexType.KEYWORD,
        KnowledgeIndexType.NAMESPACE,
        KnowledgeIndexType.TENANT,
      ],
      context: contextFixture(asset),
    });
    expect(entries).toHaveLength(3);
    expect(metrics.snapshot().indexCount).toBe(3);
  });

  it("re-running the pipeline for the same Asset replaces rather than duplicates in the Registry", async () => {
    const registry = new KnowledgeIndexRegistry();
    const metrics = new KnowledgeIndexMetrics();
    const pipeline = new KnowledgeIndexPipeline(new KnowledgeIndexValidator(), registry, metrics);
    const asset = assetFixture();
    const first = await pipeline.run({
      asset,
      indexTypes: [KnowledgeIndexType.KEYWORD],
      context: contextFixture(asset),
    });
    const second = await pipeline.run({
      asset,
      indexTypes: [KnowledgeIndexType.KEYWORD],
      context: contextFixture(asset),
    });
    expect(first[0]?.id).not.toBe(second[0]?.id);
    expect(metrics.snapshot().buildCount).toBe(2);
  });
});
