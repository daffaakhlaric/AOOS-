import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationHealth } from "../../src/health/knowledge-synchronization-health.js";
import { KnowledgeSynchronizationMetrics } from "../../src/metrics/knowledge-synchronization-metrics.js";
import { KnowledgeSynchronizationRegistryBucket } from "../../src/registry/knowledge-synchronization-registry-bucket.js";
import { KnowledgeSynchronizationRegistry } from "../../src/registry/knowledge-synchronization-registry.js";

describe("KnowledgeSynchronizationHealth", () => {
  it("reports registry status 'unknown' when nothing is registered", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    const metrics = new KnowledgeSynchronizationMetrics();
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().registry.status).toBe("unknown");
  });

  it("reports registry status 'healthy' once any bucket has an entry", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    const metrics = new KnowledgeSynchronizationMetrics();
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports synchronization status 'healthy' with no failures", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    const metrics = new KnowledgeSynchronizationMetrics();
    metrics.recordSynchronizationStarted();
    metrics.recordSynchronizationCompleted(1);
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().synchronization.status).toBe("healthy");
  });

  it("reports synchronization status 'warning' for a low failure ratio", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    const metrics = new KnowledgeSynchronizationMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordSynchronizationStarted();
    }
    metrics.recordSynchronizationFailed();
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().synchronization.status).toBe("warning");
  });

  it("reports synchronization status 'degraded' for a moderate failure ratio", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    const metrics = new KnowledgeSynchronizationMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordSynchronizationStarted();
    }
    for (let i = 0; i < 3; i += 1) {
      metrics.recordSynchronizationFailed();
    }
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().synchronization.status).toBe("degraded");
  });

  it("reports synchronization status 'unavailable' for a high failure ratio", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    const metrics = new KnowledgeSynchronizationMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordSynchronizationStarted();
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordSynchronizationFailed();
    }
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().synchronization.status).toBe("unavailable");
  });

  it("reports overall status as the worst of registry/synchronization", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, { id: "p-1" });
    const metrics = new KnowledgeSynchronizationMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordSynchronizationStarted();
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordSynchronizationFailed();
    }
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("unavailable");
  });

  it("reports overall status 'unknown' when the registry is empty, even with healthy synchronizations", () => {
    const registry = new KnowledgeSynchronizationRegistry();
    const metrics = new KnowledgeSynchronizationMetrics();
    const health = new KnowledgeSynchronizationHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("unknown");
  });
});
