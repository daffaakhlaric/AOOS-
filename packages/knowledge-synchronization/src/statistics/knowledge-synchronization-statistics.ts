import type { KnowledgeSynchronizationMode } from "../domain/knowledge-synchronization-mode.js";
import { EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS } from "../domain/knowledge-synchronization-statistics-snapshot.js";
import type { KnowledgeSynchronizationStatisticsSnapshot } from "../domain/knowledge-synchronization-statistics-snapshot.js";

/**
 * "KnowledgeSynchronizationStatistics" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md —
 * "PUBLIC API") — per-`KnowledgeSynchronizationMode` bookkeeping. Owns its own private
 * `Map<KnowledgeSynchronizationMode, KnowledgeSynchronizationStatisticsSnapshot>` rather
 * than the Registry's `STATISTICS` bucket — the bucket exists for callers who want to
 * register their *own* externally computed statistics providers; this class is this
 * package's own internal counter, mirroring `@aos/knowledge-retrieval`'s
 * `KnowledgeRetrievalStatistics`.
 */
export class KnowledgeSynchronizationStatistics {
  private readonly statsByMode = new Map<
    KnowledgeSynchronizationMode,
    KnowledgeSynchronizationStatisticsSnapshot
  >();

  get(mode: KnowledgeSynchronizationMode): KnowledgeSynchronizationStatisticsSnapshot {
    return this.statsByMode.get(mode) ?? EMPTY_KNOWLEDGE_SYNCHRONIZATION_STATISTICS;
  }

  recordSynchronization(
    mode: KnowledgeSynchronizationMode,
    changeCount: number,
  ): KnowledgeSynchronizationStatisticsSnapshot {
    const current = this.get(mode);
    const snapshot: KnowledgeSynchronizationStatisticsSnapshot = {
      syncCount: current.syncCount + 1,
      changeCount: current.changeCount + changeCount,
      lastSyncedAt: new Date().toISOString(),
    };
    this.statsByMode.set(mode, snapshot);
    return snapshot;
  }
}
