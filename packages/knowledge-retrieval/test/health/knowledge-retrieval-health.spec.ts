import { describe, expect, it } from "vitest";

import { KnowledgeRetrievalHealth } from "../../src/health/knowledge-retrieval-health.js";
import { KnowledgeRetrievalMetrics } from "../../src/metrics/knowledge-retrieval-metrics.js";
import { KnowledgeRetrievalRegistryBucket } from "../../src/registry/knowledge-retrieval-registry-bucket.js";
import { KnowledgeRetrievalRegistry } from "../../src/registry/knowledge-retrieval-registry.js";

describe("KnowledgeRetrievalHealth", () => {
  it("reports registry status 'unknown' when nothing is registered", () => {
    const registry = new KnowledgeRetrievalRegistry();
    const metrics = new KnowledgeRetrievalMetrics();
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
  });

  it("reports registry status 'healthy' once any bucket has an entry", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    const metrics = new KnowledgeRetrievalMetrics();
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports query status 'healthy' when there is no failure", () => {
    const registry = new KnowledgeRetrievalRegistry();
    const metrics = new KnowledgeRetrievalMetrics();
    metrics.recordQueryStarted();
    metrics.recordQueryCompleted(1);
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    expect(health.check().query.status).toBe("healthy");
  });

  it("reports query status 'warning' for a low failure ratio", () => {
    const registry = new KnowledgeRetrievalRegistry();
    const metrics = new KnowledgeRetrievalMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordQueryStarted();
    }
    metrics.recordQueryFailed();
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    expect(health.check().query.status).toBe("warning");
  });

  it("reports query status 'degraded' for a moderate failure ratio", () => {
    const registry = new KnowledgeRetrievalRegistry();
    const metrics = new KnowledgeRetrievalMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordQueryStarted();
    }
    for (let i = 0; i < 3; i += 1) {
      metrics.recordQueryFailed();
    }
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    expect(health.check().query.status).toBe("degraded");
  });

  it("reports query status 'unavailable' for a high failure ratio", () => {
    const registry = new KnowledgeRetrievalRegistry();
    const metrics = new KnowledgeRetrievalMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordQueryStarted();
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordQueryFailed();
    }
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    expect(health.check().query.status).toBe("unavailable");
  });

  it("reports overall status as the worst of registry/query", () => {
    const registry = new KnowledgeRetrievalRegistry();
    registry.register(KnowledgeRetrievalRegistryBucket.FILTER, { id: "f-1" });
    const metrics = new KnowledgeRetrievalMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordQueryStarted();
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordQueryFailed();
    }
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("unavailable");
  });

  it("reports overall status 'unknown' when the registry is empty, even with healthy queries", () => {
    const registry = new KnowledgeRetrievalRegistry();
    const metrics = new KnowledgeRetrievalMetrics();
    const health = new KnowledgeRetrievalHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("unknown");
  });
});
