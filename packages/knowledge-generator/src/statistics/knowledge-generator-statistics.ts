import type { KnowledgeGenerationAssetType } from "../domain/knowledge-generation-asset-type.js";
import {
  EMPTY_KNOWLEDGE_GENERATION_STATISTICS,
  type KnowledgeGenerationStatisticsSnapshot,
} from "../domain/knowledge-generation-statistics-snapshot.js";

/**
 * "KnowledgeGeneratorStatistics" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — per-`KnowledgeGenerationAssetType` bookkeeping.
 */
export class KnowledgeGeneratorStatistics {
  private readonly statsByAssetType = new Map<
    KnowledgeGenerationAssetType,
    KnowledgeGenerationStatisticsSnapshot
  >();

  get(assetType: KnowledgeGenerationAssetType): KnowledgeGenerationStatisticsSnapshot {
    return this.statsByAssetType.get(assetType) ?? EMPTY_KNOWLEDGE_GENERATION_STATISTICS;
  }

  recordRequested(assetType: KnowledgeGenerationAssetType): KnowledgeGenerationStatisticsSnapshot {
    const current = this.get(assetType);
    const snapshot: KnowledgeGenerationStatisticsSnapshot = {
      requestedCount: current.requestedCount + 1,
      completedCount: current.completedCount,
      failedCount: current.failedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByAssetType.set(assetType, snapshot);
    return snapshot;
  }

  recordCompleted(assetType: KnowledgeGenerationAssetType): KnowledgeGenerationStatisticsSnapshot {
    const current = this.get(assetType);
    const snapshot: KnowledgeGenerationStatisticsSnapshot = {
      requestedCount: current.requestedCount,
      completedCount: current.completedCount + 1,
      failedCount: current.failedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByAssetType.set(assetType, snapshot);
    return snapshot;
  }

  recordFailed(assetType: KnowledgeGenerationAssetType): KnowledgeGenerationStatisticsSnapshot {
    const current = this.get(assetType);
    const snapshot: KnowledgeGenerationStatisticsSnapshot = {
      requestedCount: current.requestedCount,
      completedCount: current.completedCount,
      failedCount: current.failedCount + 1,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByAssetType.set(assetType, snapshot);
    return snapshot;
  }
}
