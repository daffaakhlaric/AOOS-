import type { KnowledgeQualityAssessmentMode } from "../domain/knowledge-quality-assessment-mode.js";
import {
  EMPTY_KNOWLEDGE_QUALITY_ASSESSMENT_STATISTICS,
  type KnowledgeQualityAssessmentStatisticsSnapshot,
} from "../domain/knowledge-quality-assessment-statistics-snapshot.js";

/**
 * "KnowledgeQualityStatistics" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — per-`KnowledgeQualityAssessmentMode` bookkeeping (keyed by Mode rather than
 * Quality Dimension, since an Assessment always has exactly one Mode but may span many
 * Dimensions — see docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md — "Statistics").
 */
export class KnowledgeQualityStatistics {
  private readonly statsByMode = new Map<
    KnowledgeQualityAssessmentMode,
    KnowledgeQualityAssessmentStatisticsSnapshot
  >();

  get(mode: KnowledgeQualityAssessmentMode): KnowledgeQualityAssessmentStatisticsSnapshot {
    return this.statsByMode.get(mode) ?? EMPTY_KNOWLEDGE_QUALITY_ASSESSMENT_STATISTICS;
  }

  recordRequested(
    mode: KnowledgeQualityAssessmentMode,
  ): KnowledgeQualityAssessmentStatisticsSnapshot {
    const current = this.get(mode);
    const snapshot: KnowledgeQualityAssessmentStatisticsSnapshot = {
      requestedCount: current.requestedCount + 1,
      completedCount: current.completedCount,
      failedCount: current.failedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByMode.set(mode, snapshot);
    return snapshot;
  }

  recordCompleted(
    mode: KnowledgeQualityAssessmentMode,
  ): KnowledgeQualityAssessmentStatisticsSnapshot {
    const current = this.get(mode);
    const snapshot: KnowledgeQualityAssessmentStatisticsSnapshot = {
      requestedCount: current.requestedCount,
      completedCount: current.completedCount + 1,
      failedCount: current.failedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByMode.set(mode, snapshot);
    return snapshot;
  }

  recordFailed(mode: KnowledgeQualityAssessmentMode): KnowledgeQualityAssessmentStatisticsSnapshot {
    const current = this.get(mode);
    const snapshot: KnowledgeQualityAssessmentStatisticsSnapshot = {
      requestedCount: current.requestedCount,
      completedCount: current.completedCount,
      failedCount: current.failedCount + 1,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByMode.set(mode, snapshot);
    return snapshot;
  }
}
