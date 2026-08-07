import type { EmbeddingProviderType } from "../domain/embedding-provider-type.js";
import {
  EMPTY_EMBEDDING_STATISTICS,
  type EmbeddingStatisticsSnapshot,
} from "../domain/embedding-statistics-snapshot.js";

/**
 * "EmbeddingStatistics" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") —
 * per-`EmbeddingProviderType` bookkeeping (keyed by the Request's declared Provider
 * Type), mirroring the per-Category keying convention established by
 * `@aos/knowledge-validator`'s `KnowledgeValidatorStatistics`.
 */
export class EmbeddingStatistics {
  private readonly statsByProviderType = new Map<
    EmbeddingProviderType,
    EmbeddingStatisticsSnapshot
  >();

  get(providerType: EmbeddingProviderType): EmbeddingStatisticsSnapshot {
    return this.statsByProviderType.get(providerType) ?? EMPTY_EMBEDDING_STATISTICS;
  }

  recordRequested(providerType: EmbeddingProviderType): EmbeddingStatisticsSnapshot {
    return this.write(providerType, { requestedCount: this.get(providerType).requestedCount + 1 });
  }

  recordCompleted(providerType: EmbeddingProviderType): EmbeddingStatisticsSnapshot {
    return this.write(providerType, { completedCount: this.get(providerType).completedCount + 1 });
  }

  recordFailed(providerType: EmbeddingProviderType): EmbeddingStatisticsSnapshot {
    return this.write(providerType, { failedCount: this.get(providerType).failedCount + 1 });
  }

  recordCancelled(providerType: EmbeddingProviderType): EmbeddingStatisticsSnapshot {
    return this.write(providerType, { cancelledCount: this.get(providerType).cancelledCount + 1 });
  }

  private write(
    providerType: EmbeddingProviderType,
    partial: Partial<EmbeddingStatisticsSnapshot>,
  ): EmbeddingStatisticsSnapshot {
    const current = this.get(providerType);
    const snapshot: EmbeddingStatisticsSnapshot = {
      ...current,
      ...partial,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByProviderType.set(providerType, snapshot);
    return snapshot;
  }
}
