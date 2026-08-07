import {
  EMPTY_KNOWLEDGE_VERSION_STATISTICS,
  type KnowledgeVersionStatisticsSnapshot,
} from "../domain/knowledge-version-statistics-snapshot.js";
import type { KnowledgeVersionType } from "../domain/knowledge-version-type.js";

/**
 * "KnowledgeVersionStatistics" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public
 * API") — per-`KnowledgeVersionType` bookkeeping. Owns its own private
 * `Map<KnowledgeVersionType, KnowledgeVersionStatisticsSnapshot>`, separate from the
 * Registry's `STATISTICS` bucket — that bucket exists for callers who want to register
 * their own externally computed statistics providers; this class is this package's own
 * internal counter (the same split established by `@aos/knowledge-source-manager`).
 */
export class KnowledgeVersionStatistics {
  private readonly statsByType = new Map<
    KnowledgeVersionType,
    KnowledgeVersionStatisticsSnapshot
  >();

  get(versionType: KnowledgeVersionType): KnowledgeVersionStatisticsSnapshot {
    return this.statsByType.get(versionType) ?? EMPTY_KNOWLEDGE_VERSION_STATISTICS;
  }

  recordCreated(versionType: KnowledgeVersionType): KnowledgeVersionStatisticsSnapshot {
    const current = this.get(versionType);
    const snapshot: KnowledgeVersionStatisticsSnapshot = {
      createdCount: current.createdCount + 1,
      publishedCount: current.publishedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByType.set(versionType, snapshot);
    return snapshot;
  }

  recordPublished(versionType: KnowledgeVersionType): KnowledgeVersionStatisticsSnapshot {
    const current = this.get(versionType);
    const snapshot: KnowledgeVersionStatisticsSnapshot = {
      createdCount: current.createdCount,
      publishedCount: current.publishedCount + 1,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByType.set(versionType, snapshot);
    return snapshot;
  }
}
