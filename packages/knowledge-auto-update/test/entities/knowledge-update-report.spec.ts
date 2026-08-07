import { describe, expect, it } from "vitest";

import { KnowledgeUpdateReport } from "../../src/entities/knowledge-update-report.js";
import { KnowledgeUpdateReportType } from "../../src/types/report-type.js";

describe("KnowledgeUpdateReport", () => {
  it("constructs with valid props", () => {
    const report = new KnowledgeUpdateReport({
      id: "r-1",
      type: KnowledgeUpdateReportType.UpdateSummary,
      generatedAt: 100,
      data: { foo: "bar" },
    });
    expect(report.type).toBe(KnowledgeUpdateReportType.UpdateSummary);
    expect(report.data).toEqual({ foo: "bar" });
  });

  it("carries the generatedAt timestamp through unchanged", () => {
    const report = new KnowledgeUpdateReport({
      id: "r-2",
      type: KnowledgeUpdateReportType.RetryReport,
      generatedAt: 999,
      data: {},
    });
    expect(report.generatedAt).toBe(999);
  });

  it("is frozen", () => {
    const report = new KnowledgeUpdateReport({
      id: "r-1",
      type: KnowledgeUpdateReportType.StatisticsReport,
      generatedAt: 0,
      data: {},
    });
    expect(Object.isFrozen(report)).toBe(true);
  });
});
