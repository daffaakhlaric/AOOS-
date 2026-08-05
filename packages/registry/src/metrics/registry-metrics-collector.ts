import type { IRegistryMetrics, RegistryMetricsSnapshot } from "../interfaces/i-metrics.js";

/** Collects the Registry Metrics enumerated in docs/PROMPT-005.3-REGISTRY-SYSTEM.md. */
export class RegistryMetricsCollector implements IRegistryMetrics {
  private validationTimeMsTotal = 0;
  private loadTimeMsTotal = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private dependencyCount = 0;

  constructor(private readonly getRegistryCount: () => number) {}

  recordValidationTime(ms: number): void {
    this.validationTimeMsTotal += ms;
  }

  recordLoadTime(ms: number): void {
    this.loadTimeMsTotal += ms;
  }

  recordCacheHit(): void {
    this.cacheHits += 1;
  }

  recordCacheMiss(): void {
    this.cacheMisses += 1;
  }

  setDependencyCount(count: number): void {
    this.dependencyCount = count;
  }

  snapshot(): RegistryMetricsSnapshot {
    return {
      registryCount: this.getRegistryCount(),
      validationTimeMsTotal: this.validationTimeMsTotal,
      loadTimeMsTotal: this.loadTimeMsTotal,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      dependencyCount: this.dependencyCount,
    };
  }
}
