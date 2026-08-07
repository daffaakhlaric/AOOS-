import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceReport } from "../../src/entities/knowledge-intelligence-report.js";
import { ReportType } from "../../src/types/report-type.js";

describe("KnowledgeIntelligenceReport", () => {
  it("constructs a valid report", () => {
    const report = new KnowledgeIntelligenceReport({
      id: "report-1",
      type: ReportType.Health,
      title: "Health Report",
      generatedAt: 1000,
      sections: { a: 1 },
    });
    expect(report.type).toBe(ReportType.Health);
    expect(report.sections).toEqual({ a: 1 });
  });

  it("is frozen (immutable), including sections", () => {
    const report = new KnowledgeIntelligenceReport({
      id: "report-1",
      type: ReportType.Health,
      title: "x",
      generatedAt: 0,
      sections: {},
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.sections)).toBe(true);
  });

  it("throws for an empty id", () => {
    expect(
      () =>
        new KnowledgeIntelligenceReport({
          id: " ",
          type: ReportType.Health,
          title: "x",
          generatedAt: 0,
          sections: {},
        }),
    ).toThrow(RangeError);
  });

  it("throws for an empty title", () => {
    expect(
      () =>
        new KnowledgeIntelligenceReport({
          id: "report-1",
          type: ReportType.Health,
          title: " ",
          generatedAt: 0,
          sections: {},
        }),
    ).toThrow(RangeError);
  });
});
