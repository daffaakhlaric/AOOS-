export interface EmbeddingManagerMetricsSnapshot {
  readonly embeddingCount: number;
  readonly providerCount: number;
  readonly modelCount: number;
  readonly versionCount: number;
  readonly namespaceCount: number;
  readonly averageDurationMs: number;
  readonly cacheMetadataCount: number;
  readonly providerUsage: Readonly<Record<string, number>>;
  readonly checkCount: number;
  readonly checkFailureCount: number;
}

/**
 * The mutation surface `EmbeddingPipeline`'s Metrics stage drives — the exact 8 named
 * counters from "METRICS" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md: Embedding Count,
 * Provider Count, Model Count, Version Count, Namespace Count, Average Duration, Cache
 * Metadata Count, Provider Usage), plus internal check pass/fail instrumentation for
 * Statistics/Health/Monitoring. `checkCount`/`checkFailureCount` track the 12-stage
 * `EmbeddingValidator`'s pass/fail outcome per Pipeline run — distinct from the named
 * `embeddingCount` metric (which counts every Pipeline run).
 */
export interface IEmbeddingManagerMetricsCollector {
  recordEmbedding(): void;
  recordProviderRegistered(): void;
  recordModelRegistered(): void;
  recordVersionCreated(): void;
  recordNamespaceRegistered(): void;
  recordDuration(durationMs: number): void;
  recordCacheMetadata(): void;
  recordProviderUsage(providerType: string): void;
  recordCheck(success: boolean): void;
  snapshot(): EmbeddingManagerMetricsSnapshot;
}
