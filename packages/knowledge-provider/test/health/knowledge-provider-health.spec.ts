import { describe, expect, it } from "vitest";

import { KnowledgeProviderHealth } from "../../src/health/knowledge-provider-health.js";
import { KnowledgeProviderMetrics } from "../../src/metrics/knowledge-provider-metrics.js";
import { KnowledgeProviderRegistryBucket } from "../../src/registry/knowledge-provider-registry-bucket.js";
import { KnowledgeProviderRegistry } from "../../src/registry/knowledge-provider-registry.js";

describe("KnowledgeProviderHealth", () => {
  it("reports registry status 'unknown' when nothing is registered", () => {
    const registry = new KnowledgeProviderRegistry();
    const metrics = new KnowledgeProviderMetrics();
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().registry.status).toBe("unknown");
  });

  it("reports registry status 'healthy' once any bucket has an entry", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    const metrics = new KnowledgeProviderMetrics();
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().registry.status).toBe("healthy");
  });

  it("reports provider status 'healthy' with no failures", () => {
    const registry = new KnowledgeProviderRegistry();
    const metrics = new KnowledgeProviderMetrics();
    metrics.recordProviderRegistered("p-1");
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().provider.status).toBe("healthy");
  });

  it("reports provider status 'warning' for a low failure ratio", () => {
    const registry = new KnowledgeProviderRegistry();
    const metrics = new KnowledgeProviderMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordProviderRegistered(`p-${i}`);
    }
    metrics.recordFailure();
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().provider.status).toBe("warning");
  });

  it("reports provider status 'degraded' for a moderate failure ratio", () => {
    const registry = new KnowledgeProviderRegistry();
    const metrics = new KnowledgeProviderMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordProviderRegistered(`p-${i}`);
    }
    for (let i = 0; i < 3; i += 1) {
      metrics.recordFailure();
    }
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().provider.status).toBe("degraded");
  });

  it("reports provider status 'unavailable' for a high failure ratio", () => {
    const registry = new KnowledgeProviderRegistry();
    const metrics = new KnowledgeProviderMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordProviderRegistered(`p-${i}`);
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordFailure();
    }
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().provider.status).toBe("unavailable");
  });

  it("reports overall status as the worst of registry/provider", () => {
    const registry = new KnowledgeProviderRegistry();
    registry.register(KnowledgeProviderRegistryBucket.PROVIDER, { id: "p-1" });
    const metrics = new KnowledgeProviderMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordProviderRegistered(`p-${i}`);
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordFailure();
    }
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("unavailable");
  });

  it("reports overall status 'unknown' when the registry is empty, even with healthy providers", () => {
    const registry = new KnowledgeProviderRegistry();
    const metrics = new KnowledgeProviderMetrics();
    const health = new KnowledgeProviderHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("unknown");
  });
});
