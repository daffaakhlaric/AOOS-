import type { KnowledgeValidationCategory } from "../domain/knowledge-validation-category.js";
import {
  EMPTY_KNOWLEDGE_VALIDATION_STATISTICS,
  type KnowledgeValidationStatisticsSnapshot,
} from "../domain/knowledge-validation-statistics-snapshot.js";

/**
 * "KnowledgeValidatorStatistics" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — per-`KnowledgeValidationCategory` bookkeeping (keyed by the Request's primary
 * Category, since a Validation always declares exactly one primary Category on its
 * Request but may span many Rule Categories — see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-
 * REPORT.md — "Statistics").
 */
export class KnowledgeValidatorStatistics {
  private readonly statsByCategory = new Map<
    KnowledgeValidationCategory,
    KnowledgeValidationStatisticsSnapshot
  >();

  get(category: KnowledgeValidationCategory): KnowledgeValidationStatisticsSnapshot {
    return this.statsByCategory.get(category) ?? EMPTY_KNOWLEDGE_VALIDATION_STATISTICS;
  }

  recordRequested(category: KnowledgeValidationCategory): KnowledgeValidationStatisticsSnapshot {
    const current = this.get(category);
    const snapshot: KnowledgeValidationStatisticsSnapshot = {
      requestedCount: current.requestedCount + 1,
      approvedCount: current.approvedCount,
      rejectedCount: current.rejectedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByCategory.set(category, snapshot);
    return snapshot;
  }

  recordApproved(category: KnowledgeValidationCategory): KnowledgeValidationStatisticsSnapshot {
    const current = this.get(category);
    const snapshot: KnowledgeValidationStatisticsSnapshot = {
      requestedCount: current.requestedCount,
      approvedCount: current.approvedCount + 1,
      rejectedCount: current.rejectedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByCategory.set(category, snapshot);
    return snapshot;
  }

  recordRejected(category: KnowledgeValidationCategory): KnowledgeValidationStatisticsSnapshot {
    const current = this.get(category);
    const snapshot: KnowledgeValidationStatisticsSnapshot = {
      requestedCount: current.requestedCount,
      approvedCount: current.approvedCount,
      rejectedCount: current.rejectedCount + 1,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByCategory.set(category, snapshot);
    return snapshot;
  }
}
