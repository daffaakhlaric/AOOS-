import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { KnowledgeValidatorStatistics } from "../../src/statistics/knowledge-validator-statistics.js";

describe("KnowledgeValidatorStatistics", () => {
  it("returns the empty snapshot for an unrecorded category", () => {
    const statistics = new KnowledgeValidatorStatistics();
    expect(statistics.get(KnowledgeValidationCategory.STRUCTURE_VALIDATION)).toEqual({
      requestedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    });
  });

  it("recordRequested increments requestedCount", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordRequested(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    expect(statistics.get(KnowledgeValidationCategory.STRUCTURE_VALIDATION).requestedCount).toBe(1);
  });

  it("recordApproved increments approvedCount", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordApproved(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    expect(statistics.get(KnowledgeValidationCategory.STRUCTURE_VALIDATION).approvedCount).toBe(1);
  });

  it("recordRejected increments rejectedCount", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordRejected(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    expect(statistics.get(KnowledgeValidationCategory.STRUCTURE_VALIDATION).rejectedCount).toBe(1);
  });

  it("stamps lastActivityAt on every mutation", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordRequested(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    expect(
      statistics.get(KnowledgeValidationCategory.STRUCTURE_VALIDATION).lastActivityAt,
    ).toBeDefined();
  });

  it("keeps categories isolated from one another", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordRequested(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    expect(statistics.get(KnowledgeValidationCategory.SECURITY_VALIDATION).requestedCount).toBe(0);
  });

  it("accumulates multiple recordings for the same category", () => {
    const statistics = new KnowledgeValidatorStatistics();
    statistics.recordRequested(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    statistics.recordRequested(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    statistics.recordApproved(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    const snapshot = statistics.get(KnowledgeValidationCategory.STRUCTURE_VALIDATION);
    expect(snapshot.requestedCount).toBe(2);
    expect(snapshot.approvedCount).toBe(1);
  });
});
