import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidatorStatistics } from "../../src/statistics/knowledge-validator-statistics.js";

describe("KnowledgeValidatorStatistics — every category independently", () => {
  it.each(Object.values(KnowledgeValidationCategory))(
    "tracks requested/approved/rejected counters for %s in isolation",
    (category) => {
      const statistics = new KnowledgeValidatorStatistics();
      statistics.recordRequested(category);
      statistics.recordApproved(category);
      const snapshot = statistics.get(category);
      expect(snapshot.requestedCount).toBe(1);
      expect(snapshot.approvedCount).toBe(1);
      expect(snapshot.rejectedCount).toBe(0);
    },
  );
});

describe("KnowledgeValidatorStatistics — sequential mutations preserve prior counters", () => {
  it("recordApproved does not reset requestedCount", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordRequested(KnowledgeValidationCategory.SECURITY_VALIDATION);
    statistics.recordRequested(KnowledgeValidationCategory.SECURITY_VALIDATION);
    statistics.recordApproved(KnowledgeValidationCategory.SECURITY_VALIDATION);
    expect(statistics.get(KnowledgeValidationCategory.SECURITY_VALIDATION).requestedCount).toBe(2);
  });

  it("recordRejected does not reset approvedCount", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordApproved(KnowledgeValidationCategory.SECURITY_VALIDATION);
    statistics.recordRejected(KnowledgeValidationCategory.SECURITY_VALIDATION);
    const snapshot = statistics.get(KnowledgeValidationCategory.SECURITY_VALIDATION);
    expect(snapshot.approvedCount).toBe(1);
    expect(snapshot.rejectedCount).toBe(1);
  });

  it("lastActivityAt advances (or stays equal) across successive mutations", () => {
    const statistics = new KnowledgeValidatorStatistics();
    const first = statistics.recordRequested(KnowledgeValidationCategory.SECURITY_VALIDATION);
    const second = statistics.recordApproved(KnowledgeValidationCategory.SECURITY_VALIDATION);
    expect(Date.parse(second.lastActivityAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(first.lastActivityAt ?? ""),
    );
  });
});
