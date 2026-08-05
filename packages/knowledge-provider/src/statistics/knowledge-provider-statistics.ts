import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";
import { EMPTY_KNOWLEDGE_PROVIDER_STATISTICS } from "../domain/knowledge-provider-statistics-snapshot.js";
import type { KnowledgeProviderStatisticsSnapshot } from "../domain/knowledge-provider-statistics-snapshot.js";

/**
 * "KnowledgeProviderStatistics" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC
 * API") — per-`KnowledgeProviderCategory` bookkeeping. Owns its own private
 * `Map<KnowledgeProviderCategory, KnowledgeProviderStatisticsSnapshot>` rather than the
 * Registry's `STATISTICS` bucket — that bucket exists for callers who want to register
 * their own externally computed statistics providers; this class is this package's own
 * internal counter, mirroring `@aos/knowledge-synchronization`'s
 * `KnowledgeSynchronizationStatistics`.
 */
export class KnowledgeProviderStatistics {
  private readonly statsByCategory = new Map<
    KnowledgeProviderCategory,
    KnowledgeProviderStatisticsSnapshot
  >();

  get(category: KnowledgeProviderCategory): KnowledgeProviderStatisticsSnapshot {
    return this.statsByCategory.get(category) ?? EMPTY_KNOWLEDGE_PROVIDER_STATISTICS;
  }

  recordRegistration(
    category: KnowledgeProviderCategory,
    usageCount = 0,
  ): KnowledgeProviderStatisticsSnapshot {
    const current = this.get(category);
    const snapshot: KnowledgeProviderStatisticsSnapshot = {
      registrationCount: current.registrationCount + 1,
      usageCount: current.usageCount + usageCount,
      lastUsedAt: new Date().toISOString(),
    };
    this.statsByCategory.set(category, snapshot);
    return snapshot;
  }
}
