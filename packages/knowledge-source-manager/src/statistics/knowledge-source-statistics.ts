import type { KnowledgeSourceCategory } from "../domain/knowledge-source-category.js";
import { EMPTY_KNOWLEDGE_SOURCE_STATISTICS } from "../domain/knowledge-source-statistics-snapshot.js";
import type { KnowledgeSourceStatisticsSnapshot } from "../domain/knowledge-source-statistics-snapshot.js";

/**
 * "KnowledgeSourceStatistics" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC
 * API") — per-`KnowledgeSourceCategory` bookkeeping. Owns its own private
 * `Map<KnowledgeSourceCategory, KnowledgeSourceStatisticsSnapshot>` rather than the
 * Registry's `STATISTICS` bucket — that bucket exists for callers who want to register
 * their own externally computed statistics providers; this class is this package's own
 * internal counter.
 */
export class KnowledgeSourceStatistics {
  private readonly statsByCategory = new Map<
    KnowledgeSourceCategory,
    KnowledgeSourceStatisticsSnapshot
  >();

  get(category: KnowledgeSourceCategory): KnowledgeSourceStatisticsSnapshot {
    return this.statsByCategory.get(category) ?? EMPTY_KNOWLEDGE_SOURCE_STATISTICS;
  }

  recordRegistration(
    category: KnowledgeSourceCategory,
    usageCount = 0,
  ): KnowledgeSourceStatisticsSnapshot {
    const current = this.get(category);
    const snapshot: KnowledgeSourceStatisticsSnapshot = {
      registrationCount: current.registrationCount + 1,
      usageCount: current.usageCount + usageCount,
      lastUsedAt: new Date().toISOString(),
    };
    this.statsByCategory.set(category, snapshot);
    return snapshot;
  }
}
