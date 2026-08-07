import { describe, expect, it } from "vitest";

import { KnowledgeUpdateReportBuilder } from "../../src/builders/knowledge-update-report-builder.js";
import { KnowledgeUpdateReportType } from "../../src/types/report-type.js";

describe("KnowledgeUpdateReportBuilder", () => {
  it("builds a report with the configured type and data", () => {
    const report = new KnowledgeUpdateReportBuilder()
      .ofType(KnowledgeUpdateReportType.SchedulerReport)
      .withField("queueSize", 5)
      .build(100);
    expect(report.type).toBe(KnowledgeUpdateReportType.SchedulerReport);
    expect(report.data).toEqual({ queueSize: 5 });
    expect(report.generatedAt).toBe(100);
  });

  it("supports chaining withField multiple times", () => {
    const report = new KnowledgeUpdateReportBuilder()
      .ofType(KnowledgeUpdateReportType.RetryReport)
      .withField("a", 1)
      .withField("b", 2)
      .build(0);
    expect(report.data).toEqual({ a: 1, b: 2 });
  });

  it("supports withData merging a bulk object", () => {
    const report = new KnowledgeUpdateReportBuilder()
      .ofType(KnowledgeUpdateReportType.ConflictReport)
      .withData({ x: 1, y: 2 })
      .build(0);
    expect(report.data).toEqual({ x: 1, y: 2 });
  });

  it("withData merges on top of prior fields", () => {
    const report = new KnowledgeUpdateReportBuilder()
      .ofType(KnowledgeUpdateReportType.RefreshReport)
      .withField("a", 1)
      .withData({ a: 2, b: 3 })
      .build(0);
    expect(report.data).toEqual({ a: 2, b: 3 });
  });

  it("throws when build() is called without a type", () => {
    expect(() => new KnowledgeUpdateReportBuilder().build(0)).toThrow(RangeError);
  });

  it("generates a fresh id per build", () => {
    const builder = new KnowledgeUpdateReportBuilder().ofType(
      KnowledgeUpdateReportType.PolicyReport,
    );
    const a = builder.build(0);
    const b = builder.build(0);
    expect(a.id).not.toBe(b.id);
  });

  it("withData called with an empty object leaves prior fields intact", () => {
    const report = new KnowledgeUpdateReportBuilder()
      .ofType(KnowledgeUpdateReportType.SessionReport)
      .withField("x", 1)
      .withData({})
      .build(0);
    expect(report.data).toEqual({ x: 1 });
  });

  it("each of the 10 report types can be built", () => {
    for (const type of Object.values(KnowledgeUpdateReportType)) {
      const report = new KnowledgeUpdateReportBuilder().ofType(type).build(0);
      expect(report.type).toBe(type);
    }
  });
});
