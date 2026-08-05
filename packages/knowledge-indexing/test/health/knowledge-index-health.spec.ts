import { describe, expect, it } from "vitest";

import { KnowledgeIndexBuilder } from "../../src/builder/knowledge-index-builder.js";
import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexHealth } from "../../src/health/knowledge-index-health.js";
import { KnowledgeIndexMetrics } from "../../src/metrics/knowledge-index-metrics.js";
import { KnowledgeIndexRegistryBucket } from "../../src/registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Health Test — KnowledgeIndexHealth", () => {
  it("reports registry status 'unknown' when empty", () => {
    const metrics = new KnowledgeIndexMetrics();
    const health = new KnowledgeIndexHealth(new KnowledgeIndexRegistry(), () => metrics.snapshot());
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
    expect(report.status).toBe("unknown");
  });

  it("reports registry status 'healthy' once populated", () => {
    const registry = new KnowledgeIndexRegistry();
    const asset = assetFixture();
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.KEYWORD,
      contextFixture(asset),
    );
    registry.register(KnowledgeIndexRegistryBucket.INDEX, entry!);
    const metrics = new KnowledgeIndexMetrics();
    const health = new KnowledgeIndexHealth(registry, () => metrics.snapshot());
    expect(health.check().registry.status).toBe("healthy");
  });

  it("derives build status 'warning' from a low but non-zero failure ratio", () => {
    const metrics = new KnowledgeIndexMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordBuildCompleted(1);
    }
    metrics.recordBuildFailed();
    const health = new KnowledgeIndexHealth(new KnowledgeIndexRegistry(), () => metrics.snapshot());
    expect(health.check().build.status).toBe("warning");
  });

  it("derives build status 'degraded' from a moderate failure ratio", () => {
    const metrics = new KnowledgeIndexMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordBuildCompleted(1);
    }
    for (let i = 0; i < 3; i += 1) {
      metrics.recordBuildFailed();
    }
    const health = new KnowledgeIndexHealth(new KnowledgeIndexRegistry(), () => metrics.snapshot());
    expect(health.check().build.status).toBe("degraded");
  });

  it("derives build status 'unavailable' from a majority failure ratio", () => {
    const metrics = new KnowledgeIndexMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordBuildCompleted(1);
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordBuildFailed();
    }
    const health = new KnowledgeIndexHealth(new KnowledgeIndexRegistry(), () => metrics.snapshot());
    expect(health.check().build.status).toBe("unavailable");
  });

  it("reports overall status 'healthy' with a populated Registry and no failures", () => {
    const registry = new KnowledgeIndexRegistry();
    const asset = assetFixture();
    const [entry] = new KnowledgeIndexBuilder().build(
      asset,
      KnowledgeIndexType.KEYWORD,
      contextFixture(asset),
    );
    registry.register(KnowledgeIndexRegistryBucket.INDEX, entry!);
    const metrics = new KnowledgeIndexMetrics();
    metrics.recordBuildCompleted(1);
    const health = new KnowledgeIndexHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("healthy");
  });
});
