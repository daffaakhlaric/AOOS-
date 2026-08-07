import { describe, expect, it } from "vitest";

import { KnowledgeHealthReport } from "../../src/entities/knowledge-health-report.js";
import { HealthStatus } from "../../src/types/health-status.js";
import { KnowledgeHealthScore } from "../../src/value-objects/knowledge-health-score.js";

function makeHealthScore(): KnowledgeHealthScore {
  return new KnowledgeHealthScore({
    overall: 80,
    quality: 80,
    freshness: 80,
    coverage: 80,
    risk: 20,
    status: HealthStatus.Healthy,
  });
}

describe("KnowledgeHealthReport", () => {
  it("constructs a valid report", () => {
    const report = new KnowledgeHealthReport({
      id: "health-report-1",
      generatedAt: 1000,
      overallScore: makeHealthScore(),
      itemScores: [{ itemId: "item-1", score: makeHealthScore() }],
    });
    expect(report.itemScores).toHaveLength(1);
  });

  it("is frozen (immutable), including itemScores", () => {
    const report = new KnowledgeHealthReport({
      id: "health-report-1",
      generatedAt: 0,
      overallScore: makeHealthScore(),
      itemScores: [],
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.itemScores)).toBe(true);
  });

  it("throws for an empty id", () => {
    expect(
      () =>
        new KnowledgeHealthReport({
          id: " ",
          generatedAt: 0,
          overallScore: makeHealthScore(),
          itemScores: [],
        }),
    ).toThrow(RangeError);
  });
});
