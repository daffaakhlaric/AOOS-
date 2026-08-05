export interface RegistryMetricsSnapshot {
  readonly registryCount: number;
  readonly validationTimeMsTotal: number;
  readonly loadTimeMsTotal: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly dependencyCount: number;
}

/** Port for the Registry's own metrics collection (Registry Count, Validation/Load Time, Cache Hit/Miss, Dependency Count). */
export interface IRegistryMetrics {
  recordValidationTime(ms: number): void;
  recordLoadTime(ms: number): void;
  recordCacheHit(): void;
  recordCacheMiss(): void;
  setDependencyCount(count: number): void;
  snapshot(): RegistryMetricsSnapshot;
}
