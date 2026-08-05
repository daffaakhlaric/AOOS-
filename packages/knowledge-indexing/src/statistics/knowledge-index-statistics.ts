import { EMPTY_KNOWLEDGE_INDEX_STATISTICS } from "../domain/knowledge-index-statistics-snapshot.js";
import type { KnowledgeIndexStatisticsSnapshot } from "../domain/knowledge-index-statistics-snapshot.js";
import type { KnowledgeIndexType } from "../domain/knowledge-index-type.js";
import { KnowledgeIndexRegistryBucket } from "../registry/knowledge-index-registry-bucket.js";
import type { KnowledgeIndexRegistry } from "../registry/knowledge-index-registry.js";

interface StatisticsRecord extends KnowledgeIndexStatisticsSnapshot {
  readonly id: string;
}

/**
 * "KnowledgeIndexStatistics" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "PUBLIC API") —
 * per-`KnowledgeIndexType` bookkeeping ("Registry: Maintain ... Statistics"), stored in
 * `KnowledgeIndexRegistry`'s `STATISTICS` bucket keyed by `KnowledgeIndexType`.
 */
export class KnowledgeIndexStatistics {
  constructor(private readonly registry: KnowledgeIndexRegistry) {}

  get(indexType: KnowledgeIndexType): KnowledgeIndexStatisticsSnapshot {
    return (
      this.registry.get<StatisticsRecord>(KnowledgeIndexRegistryBucket.STATISTICS, indexType) ??
      EMPTY_KNOWLEDGE_INDEX_STATISTICS
    );
  }

  recordBuilt(indexType: KnowledgeIndexType, count = 1): KnowledgeIndexStatisticsSnapshot {
    const current = this.get(indexType);
    return this.write(indexType, {
      ...current,
      entryCount: current.entryCount + count,
      lastBuiltAt: new Date().toISOString(),
    });
  }

  recordRemoved(indexType: KnowledgeIndexType, count = 1): KnowledgeIndexStatisticsSnapshot {
    const current = this.get(indexType);
    return this.write(indexType, {
      ...current,
      entryCount: Math.max(0, current.entryCount - count),
    });
  }

  recordOptimized(indexType: KnowledgeIndexType): KnowledgeIndexStatisticsSnapshot {
    const current = this.get(indexType);
    return this.write(indexType, { ...current, lastOptimizedAt: new Date().toISOString() });
  }

  recordRebuilt(indexType: KnowledgeIndexType): KnowledgeIndexStatisticsSnapshot {
    const current = this.get(indexType);
    return this.write(indexType, { ...current, lastRebuiltAt: new Date().toISOString() });
  }

  private write(
    indexType: KnowledgeIndexType,
    snapshot: KnowledgeIndexStatisticsSnapshot,
  ): KnowledgeIndexStatisticsSnapshot {
    this.registry.replace<StatisticsRecord>(KnowledgeIndexRegistryBucket.STATISTICS, {
      id: indexType,
      ...snapshot,
    });
    return snapshot;
  }
}
