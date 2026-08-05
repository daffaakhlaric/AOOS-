import { describe, expect, it } from "vitest";

import { KnowledgeHealth } from "../../src/health/knowledge-health.js";
import { KnowledgeMetrics } from "../../src/metrics/knowledge-metrics.js";
import { KnowledgeRegistryBucket } from "../../src/registry/knowledge-registry-bucket.js";
import { KnowledgeRegistry } from "../../src/registry/knowledge-registry.js";
import { KnowledgeRepository } from "../../src/repository/knowledge-repository.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Health Test — KnowledgeHealth", () => {
  it("reports repository/registry status 'unknown' when both are empty", () => {
    const metrics = new KnowledgeMetrics();
    const health = new KnowledgeHealth(new KnowledgeRepository(), new KnowledgeRegistry(), () =>
      metrics.snapshot(),
    );
    const report = health.check();
    expect(report.repository.status).toBe("unknown");
    expect(report.registry.status).toBe("unknown");
    expect(report.status).toBe("unknown");
  });

  it("reports repository/registry status 'healthy' once populated", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture());
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.CATEGORY, { id: "cat-1" });
    const metrics = new KnowledgeMetrics();
    const health = new KnowledgeHealth(repository, registry, () => metrics.snapshot());
    const report = health.check();
    expect(report.repository.status).toBe("healthy");
    expect(report.registry.status).toBe("healthy");
  });

  it("derives validation status 'warning' from a low but non-zero error ratio", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture());
    const metrics = new KnowledgeMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordAssetCreated(false);
    }
    metrics.recordValidationError();
    const health = new KnowledgeHealth(repository, new KnowledgeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().validation.status).toBe("warning");
  });

  it("derives validation status 'degraded' from a moderate error ratio", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture());
    const metrics = new KnowledgeMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordAssetCreated(false);
    }
    for (let i = 0; i < 3; i += 1) {
      metrics.recordValidationError();
    }
    const health = new KnowledgeHealth(repository, new KnowledgeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().validation.status).toBe("degraded");
  });

  it("derives validation status 'unavailable' from a majority error ratio", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture());
    const metrics = new KnowledgeMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordAssetCreated(false);
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordValidationError();
    }
    const health = new KnowledgeHealth(repository, new KnowledgeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().validation.status).toBe("unavailable");
  });

  it("reports overall status 'healthy' with populated stores, no activity and no errors", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture());
    const registry = new KnowledgeRegistry();
    registry.register(KnowledgeRegistryBucket.CATEGORY, { id: "cat-1" });
    const metrics = new KnowledgeMetrics();
    const health = new KnowledgeHealth(repository, registry, () => metrics.snapshot());
    expect(health.check().status).toBe("healthy");
  });
});
