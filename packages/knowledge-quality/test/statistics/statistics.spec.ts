import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityStatistics } from "../../src/statistics/knowledge-quality-statistics.js";

describe("KnowledgeQualityStatistics", () => {
  it("returns the empty snapshot for an untouched Assessment Mode", () => {
    const statistics = new KnowledgeQualityStatistics();
    expect(statistics.get(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT)).toEqual({
      requestedCount: 0,
      completedCount: 0,
      failedCount: 0,
    });
  });

  it("recordRequested() increments requestedCount", () => {
    const statistics = new KnowledgeQualityStatistics();
    statistics.recordRequested(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT);
    statistics.recordRequested(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT);
    expect(statistics.get(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT).requestedCount).toBe(2);
  });

  it("recordCompleted() increments completedCount", () => {
    const statistics = new KnowledgeQualityStatistics();
    statistics.recordCompleted(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    expect(statistics.get(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT).completedCount).toBe(1);
  });

  it("recordFailed() increments failedCount", () => {
    const statistics = new KnowledgeQualityStatistics();
    statistics.recordFailed(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    expect(statistics.get(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT).failedCount).toBe(1);
  });

  it("keeps Assessment Modes independent", () => {
    const statistics = new KnowledgeQualityStatistics();
    statistics.recordRequested(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT);
    expect(statistics.get(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT).requestedCount).toBe(0);
  });

  it("stamps lastActivityAt on every mutation", () => {
    const statistics = new KnowledgeQualityStatistics();
    const snapshot = statistics.recordRequested(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT);
    expect(snapshot.lastActivityAt).toBeDefined();
  });
});
