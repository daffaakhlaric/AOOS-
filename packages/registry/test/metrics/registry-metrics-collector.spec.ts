import { describe, expect, it } from "vitest";

import { RegistryMetricsCollector } from "../../src/metrics/registry-metrics-collector.js";

describe("RegistryMetricsCollector", () => {
  it("accumulates validation and load time", () => {
    const collector = new RegistryMetricsCollector(() => 5);
    collector.recordValidationTime(10);
    collector.recordValidationTime(5);
    collector.recordLoadTime(100);

    const snapshot = collector.snapshot();
    expect(snapshot.validationTimeMsTotal).toBe(15);
    expect(snapshot.loadTimeMsTotal).toBe(100);
    expect(snapshot.registryCount).toBe(5);
  });

  it("tracks cache hit/miss counts", () => {
    const collector = new RegistryMetricsCollector(() => 0);
    collector.recordCacheHit();
    collector.recordCacheHit();
    collector.recordCacheMiss();
    const snapshot = collector.snapshot();
    expect(snapshot.cacheHits).toBe(2);
    expect(snapshot.cacheMisses).toBe(1);
  });

  it("tracks dependency count via setDependencyCount", () => {
    const collector = new RegistryMetricsCollector(() => 0);
    collector.setDependencyCount(7);
    expect(collector.snapshot().dependencyCount).toBe(7);
  });
});
