import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsReportBuilder } from "../../src/builders/knowledge-analytics-report-builder.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";

describe("KnowledgeAnalyticsReportBuilder additional coverage", () => {
  it("allows overwriting a section by calling the same withX method twice", () => {
    const builder = new KnowledgeAnalyticsReportBuilder().withUsage({ v: 1 }).withUsage({ v: 2 });
    const report = builder.build(KnowledgeReportType.Usage, { generatedAt: 0 });
    expect(report.sections.usage).toEqual({ v: 2 });
  });

  it("Search/Retrieval/Query sections are included in Summary but have no dedicated report type", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withSearch({ a: 1 })
      .withRetrieval({ b: 2 })
      .withQuery({ c: 3 })
      .build(KnowledgeReportType.Summary, { generatedAt: 0 });
    expect(report.sections).toEqual({ search: { a: 1 }, retrieval: { b: 2 }, query: { c: 3 } });
  });

  it("accepts primitive section values, not just objects", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withUsage(42)
      .build(KnowledgeReportType.Usage, { generatedAt: 0 });
    expect(report.sections.usage).toBe(42);
  });

  it("accepts null as a section value", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withGraph(null)
      .build(KnowledgeReportType.Graph, { generatedAt: 0 });
    expect(report.sections.graph).toBeNull();
  });

  it("each report produced by build() has a unique generated id", () => {
    const builder = new KnowledgeAnalyticsReportBuilder().withUsage({});
    const ids = new Set(
      Array.from(
        { length: 10 },
        () => builder.build(KnowledgeReportType.Usage, { generatedAt: 0 }).id,
      ),
    );
    expect(ids.size).toBe(10);
  });

  it("build() does not leak sections from other domains into a single-domain report", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withUsage({ a: 1 })
      .withCost({ b: 2 })
      .build(KnowledgeReportType.Usage, { generatedAt: 0 });
    expect(report.sections).not.toHaveProperty("cost");
  });
});
