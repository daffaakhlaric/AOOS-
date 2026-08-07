import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsReport } from "../../src/reports/knowledge-analytics-report.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";

describe("KnowledgeAnalyticsReport", () => {
  const build = () =>
    new KnowledgeAnalyticsReport({
      id: "report_1",
      type: KnowledgeReportType.Usage,
      generatedAt: 1000,
      sections: { usage: { documentCount: 5 } },
    });

  it("stores every constructor property", () => {
    const report = build();
    expect(report.id).toBe("report_1");
    expect(report.type).toBe(KnowledgeReportType.Usage);
    expect(report.generatedAt).toBe(1000);
    expect(report.sections).toEqual({ usage: { documentCount: 5 } });
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(build())).toBe(true);
  });

  it("freezes sections", () => {
    expect(Object.isFrozen(build().sections)).toBe(true);
  });

  it("defensively copies the sections object (mutating the input does not affect the report)", () => {
    const sections = { usage: { documentCount: 5 } };
    const report = new KnowledgeAnalyticsReport({
      id: "r",
      type: KnowledgeReportType.Usage,
      generatedAt: 0,
      sections,
    });
    sections.usage = { documentCount: 999 };
    expect(report.sections.usage).toEqual({ documentCount: 5 });
  });
});
