import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityStatistics } from "../../src/statistics/knowledge-quality-statistics.js";

describe("KnowledgeQualityStatistics — accumulation edge cases", () => {
  it("accumulates requested/completed/failed counters together for one mode", () => {
    const statistics = new KnowledgeQualityStatistics();
    statistics.recordRequested(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    statistics.recordRequested(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    statistics.recordCompleted(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    statistics.recordFailed(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    const snapshot = statistics.get(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT);
    expect(snapshot).toMatchObject({ requestedCount: 2, completedCount: 1, failedCount: 1 });
  });

  it("advances lastActivityAt on every subsequent mutation", () => {
    const statistics = new KnowledgeQualityStatistics();
    const first = statistics.recordRequested(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT);
    const second = statistics.recordCompleted(KnowledgeQualityAssessmentMode.QUICK_ASSESSMENT);
    expect(Date.parse(second.lastActivityAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(first.lastActivityAt ?? ""),
    );
  });

  it("tracks every Assessment Mode independently across all 8 modes", () => {
    const statistics = new KnowledgeQualityStatistics();
    for (const mode of Object.values(KnowledgeQualityAssessmentMode)) {
      statistics.recordRequested(mode);
    }
    for (const mode of Object.values(KnowledgeQualityAssessmentMode)) {
      expect(statistics.get(mode).requestedCount).toBe(1);
    }
  });

  it("recordCompleted() does not mutate requestedCount/failedCount", () => {
    const statistics = new KnowledgeQualityStatistics();
    statistics.recordRequested(KnowledgeQualityAssessmentMode.EDITORIAL_REVIEW);
    statistics.recordCompleted(KnowledgeQualityAssessmentMode.EDITORIAL_REVIEW);
    const snapshot = statistics.get(KnowledgeQualityAssessmentMode.EDITORIAL_REVIEW);
    expect(snapshot.requestedCount).toBe(1);
    expect(snapshot.failedCount).toBe(0);
  });

  it("recordFailed() does not mutate requestedCount/completedCount", () => {
    const statistics = new KnowledgeQualityStatistics();
    statistics.recordRequested(KnowledgeQualityAssessmentMode.COMPLIANCE_REVIEW);
    statistics.recordFailed(KnowledgeQualityAssessmentMode.COMPLIANCE_REVIEW);
    const snapshot = statistics.get(KnowledgeQualityAssessmentMode.COMPLIANCE_REVIEW);
    expect(snapshot.requestedCount).toBe(1);
    expect(snapshot.completedCount).toBe(0);
  });
});
