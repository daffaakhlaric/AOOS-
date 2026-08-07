import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsSummary } from "../../src/entities/knowledge-analytics-summary.js";

describe("KnowledgeAnalyticsSummary", () => {
  const build = () =>
    new KnowledgeAnalyticsSummary({
      id: "summary_1",
      generatedAt: 1000,
      totalSamplesRecorded: 50,
      totalReportsGenerated: 3,
      totalMetricsTracked: 30,
      categoryTotals: { usage: 10, search: 40 },
    });

  it("stores every constructor property", () => {
    const summary = build();
    expect(summary.id).toBe("summary_1");
    expect(summary.generatedAt).toBe(1000);
    expect(summary.totalSamplesRecorded).toBe(50);
    expect(summary.totalReportsGenerated).toBe(3);
    expect(summary.totalMetricsTracked).toBe(30);
    expect(summary.categoryTotals).toEqual({ usage: 10, search: 40 });
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(build())).toBe(true);
  });

  it("freezes categoryTotals", () => {
    expect(Object.isFrozen(build().categoryTotals)).toBe(true);
  });
});
