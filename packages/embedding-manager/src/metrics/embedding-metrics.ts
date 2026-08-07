import type {
  EmbeddingManagerMetricsSnapshot,
  IEmbeddingManagerMetricsCollector,
} from "./i-embedding-manager-metrics-collector.js";

/**
 * "METRICS: Embedding Count, Provider Count, Model Count, Version Count, Namespace
 * Count, Average Duration, Cache Metadata Count, Provider Usage."
 * (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — a live in-memory snapshot of the 8 named
 * counters, computed as a real running average (not a stub), plus internal check
 * instrumentation for Statistics/Health/Monitoring.
 */
export class EmbeddingMetrics implements IEmbeddingManagerMetricsCollector {
  private embeddingCount = 0;
  private providerCount = 0;
  private modelCount = 0;
  private versionCount = 0;
  private namespaceCount = 0;
  private cacheMetadataCount = 0;
  private totalDurationMs = 0;
  private durationSamples = 0;
  private checkCount = 0;
  private checkFailureCount = 0;
  private readonly providerUsage = new Map<string, number>();

  recordEmbedding(): void {
    this.embeddingCount += 1;
  }

  recordProviderRegistered(): void {
    this.providerCount += 1;
  }

  recordModelRegistered(): void {
    this.modelCount += 1;
  }

  recordVersionCreated(): void {
    this.versionCount += 1;
  }

  recordNamespaceRegistered(): void {
    this.namespaceCount += 1;
  }

  recordCacheMetadata(): void {
    this.cacheMetadataCount += 1;
  }

  recordDuration(durationMs: number): void {
    this.totalDurationMs += durationMs;
    this.durationSamples += 1;
  }

  recordProviderUsage(providerType: string): void {
    this.providerUsage.set(providerType, (this.providerUsage.get(providerType) ?? 0) + 1);
  }

  recordCheck(success: boolean): void {
    this.checkCount += 1;
    if (!success) {
      this.checkFailureCount += 1;
    }
  }

  snapshot(): EmbeddingManagerMetricsSnapshot {
    return {
      embeddingCount: this.embeddingCount,
      providerCount: this.providerCount,
      modelCount: this.modelCount,
      versionCount: this.versionCount,
      namespaceCount: this.namespaceCount,
      averageDurationMs:
        this.durationSamples === 0 ? 0 : this.totalDurationMs / this.durationSamples,
      cacheMetadataCount: this.cacheMetadataCount,
      providerUsage: Object.fromEntries(this.providerUsage),
      checkCount: this.checkCount,
      checkFailureCount: this.checkFailureCount,
    };
  }
}
