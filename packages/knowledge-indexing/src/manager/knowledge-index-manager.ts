import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import { KnowledgeIndexRegistryBucket } from "../registry/knowledge-index-registry-bucket.js";
import { KnowledgeIndexRegistry } from "../registry/knowledge-index-registry.js";
import { KnowledgeIndexScheduler } from "../scheduler/knowledge-index-scheduler.js";
import { KnowledgeIndexStatistics } from "../statistics/knowledge-index-statistics.js";

/**
 * The mid-level orchestrator combining `KnowledgeIndexRegistry` (Entry bookkeeping),
 * `KnowledgeIndexStatistics` (per-`KnowledgeIndexType` counters), and
 * `KnowledgeIndexScheduler` (reindex job ledger) behind one API — the layer
 * `KnowledgeIndexer`/`KnowledgeIndexing` delegate all state-holding to.
 */
export class KnowledgeIndexManager {
  readonly registry = new KnowledgeIndexRegistry();
  readonly statistics = new KnowledgeIndexStatistics(this.registry);
  readonly scheduler = new KnowledgeIndexScheduler();

  registerEntries(entries: readonly KnowledgeIndexEntry[]): readonly KnowledgeIndexEntry[] {
    for (const entry of entries) {
      this.registry.replace(KnowledgeIndexRegistryBucket.INDEX, entry);
    }
    const countsByType = new Map<string, number>();
    for (const entry of entries) {
      countsByType.set(entry.indexType, (countsByType.get(entry.indexType) ?? 0) + 1);
    }
    for (const [indexType, count] of countsByType) {
      this.statistics.recordBuilt(indexType as KnowledgeIndexEntry["indexType"], count);
    }
    return entries;
  }

  removeEntriesForAsset(assetId: string): number {
    const existing = this.registry
      .list<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX)
      .filter((entry) => entry.assetId === assetId);
    for (const entry of existing) {
      this.registry.remove(KnowledgeIndexRegistryBucket.INDEX, entry.id);
      this.statistics.recordRemoved(entry.indexType);
    }
    return existing.length;
  }

  getEntry(id: string): KnowledgeIndexEntry | undefined {
    return this.registry.get<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX, id);
  }

  requireEntry(id: string): KnowledgeIndexEntry {
    return this.registry.require<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX, id);
  }

  listByAsset(assetId: string): readonly KnowledgeIndexEntry[] {
    return this.registry
      .list<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX)
      .filter((entry) => entry.assetId === assetId);
  }

  count(): number {
    return this.registry.count(KnowledgeIndexRegistryBucket.INDEX);
  }
}
