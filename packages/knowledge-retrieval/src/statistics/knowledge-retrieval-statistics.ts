import { EMPTY_KNOWLEDGE_RETRIEVAL_STATISTICS } from "../domain/knowledge-retrieval-statistics-snapshot.js";
import type { KnowledgeRetrievalStatisticsSnapshot } from "../domain/knowledge-retrieval-statistics-snapshot.js";
import type { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";

/**
 * "KnowledgeRetrievalStatistics" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "PUBLIC
 * API") — per-`KnowledgeSearchMode` bookkeeping. `KnowledgeSearchMode` is deliberately
 * **not** one of `KnowledgeRetrievalRegistry`'s 7 buckets (the source prompt's own
 * Registry list omits "Statistics"), so this class owns its own private
 * `Map<KnowledgeSearchMode, KnowledgeRetrievalStatisticsSnapshot>` — mirroring
 * `@aos/knowledge-engine`'s `KnowledgePermissionEngine`, which makes the identical
 * judgment call for the same reason.
 */
export class KnowledgeRetrievalStatistics {
  private readonly statsByMode = new Map<
    KnowledgeSearchMode,
    KnowledgeRetrievalStatisticsSnapshot
  >();

  get(mode: KnowledgeSearchMode): KnowledgeRetrievalStatisticsSnapshot {
    return this.statsByMode.get(mode) ?? EMPTY_KNOWLEDGE_RETRIEVAL_STATISTICS;
  }

  recordQuery(
    mode: KnowledgeSearchMode,
    resultCount: number,
  ): KnowledgeRetrievalStatisticsSnapshot {
    const current = this.get(mode);
    const snapshot: KnowledgeRetrievalStatisticsSnapshot = {
      queryCount: current.queryCount + 1,
      resultCount: current.resultCount + resultCount,
      lastQueriedAt: new Date().toISOString(),
    };
    this.statsByMode.set(mode, snapshot);
    return snapshot;
  }
}
