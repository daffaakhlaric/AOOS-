import { describe, expect, it } from "vitest";

import { KnowledgeGapReport } from "../../src/entities/knowledge-gap-report.js";

describe("KnowledgeGapReport", () => {
  it("constructs a valid gap report", () => {
    const report = new KnowledgeGapReport({
      id: "gap-report-1",
      generatedAt: 1000,
      coverageScore: 60,
      gaps: [{ topic: "billing", itemCount: 0 }],
      orphans: [{ itemId: "item-1" }],
    });
    expect(report.gaps).toHaveLength(1);
    expect(report.orphans).toHaveLength(1);
  });

  it("is frozen (immutable), including gaps and orphans", () => {
    const report = new KnowledgeGapReport({
      id: "gap-report-1",
      generatedAt: 0,
      coverageScore: 100,
      gaps: [],
      orphans: [],
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.gaps)).toBe(true);
    expect(Object.isFrozen(report.orphans)).toBe(true);
  });

  it("throws when coverageScore is outside [0, 100]", () => {
    expect(
      () =>
        new KnowledgeGapReport({
          id: "a",
          generatedAt: 0,
          coverageScore: -1,
          gaps: [],
          orphans: [],
        }),
    ).toThrow(RangeError);
    expect(
      () =>
        new KnowledgeGapReport({
          id: "a",
          generatedAt: 0,
          coverageScore: 101,
          gaps: [],
          orphans: [],
        }),
    ).toThrow(RangeError);
  });
});
