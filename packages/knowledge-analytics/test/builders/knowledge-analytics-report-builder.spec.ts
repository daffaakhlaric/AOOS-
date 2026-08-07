import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsReportBuilder } from "../../src/builders/knowledge-analytics-report-builder.js";
import { InvalidReportTypeException } from "../../src/errors/invalid-report-type-exception.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";

describe("KnowledgeAnalyticsReportBuilder", () => {
  it("builds a Usage report containing only the usage section", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withUsage({ documentCount: 5 })
      .build(KnowledgeReportType.Usage, { generatedAt: 1000 });
    expect(report.type).toBe(KnowledgeReportType.Usage);
    expect(report.sections).toEqual({ usage: { documentCount: 5 } });
  });

  it.each([
    ["Performance" as const, KnowledgeReportType.Performance, "withPerformance", "performance"],
    ["Graph" as const, KnowledgeReportType.Graph, "withGraph", "graph"],
    ["Quality" as const, KnowledgeReportType.Quality, "withQuality", "quality"],
    ["Embedding" as const, KnowledgeReportType.Embedding, "withEmbedding", "embedding"],
    ["Trend" as const, KnowledgeReportType.Trend, "withTrend", "trend"],
    ["Cost" as const, KnowledgeReportType.Cost, "withCost", "cost"],
    [
      "Recommendation" as const,
      KnowledgeReportType.Recommendation,
      "withRecommendation",
      "recommendation",
    ],
  ])("builds a %s report containing only its own section", (_label, type, method, key) => {
    const builder = new KnowledgeAnalyticsReportBuilder() as unknown as Record<
      string,
      (value: unknown) => KnowledgeAnalyticsReportBuilder
    >;
    builder[method]!({ value: 1 });
    const report = (builder as unknown as KnowledgeAnalyticsReportBuilder).build(type, {
      generatedAt: 1000,
    });
    expect(report.sections).toEqual({ [key]: { value: 1 } });
  });

  it("builds a Summary report including every section supplied so far", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withUsage({ a: 1 })
      .withSearch({ b: 2 })
      .build(KnowledgeReportType.Summary, { generatedAt: 1000 });
    expect(report.sections).toEqual({ usage: { a: 1 }, search: { b: 2 } });
  });

  it("builds an empty Summary report when no sections were supplied", () => {
    const report = new KnowledgeAnalyticsReportBuilder().build(KnowledgeReportType.Summary, {
      generatedAt: 1000,
    });
    expect(report.sections).toEqual({});
  });

  it("builds a DashboardSnapshot-type report including every section supplied so far", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withGraph({ nodeCount: 1 })
      .build(KnowledgeReportType.DashboardSnapshot, { generatedAt: 1000 });
    expect(report.sections).toEqual({ graph: { nodeCount: 1 } });
  });

  it("throws InvalidReportTypeException for a single-domain type missing its section", () => {
    expect(() =>
      new KnowledgeAnalyticsReportBuilder().build(KnowledgeReportType.Usage, { generatedAt: 1000 }),
    ).toThrow(InvalidReportTypeException);
  });

  it("throws InvalidReportTypeException for an unrecognized type", () => {
    expect(() =>
      new KnowledgeAnalyticsReportBuilder().build("bogus_report" as KnowledgeReportType, {
        generatedAt: 1000,
      }),
    ).toThrow(InvalidReportTypeException);
  });

  it("generates an id automatically when none is supplied", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withUsage({ a: 1 })
      .build(KnowledgeReportType.Usage, { generatedAt: 1000 });
    expect(report.id.startsWith("report_")).toBe(true);
  });

  it("uses a supplied id verbatim", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withUsage({ a: 1 })
      .build(KnowledgeReportType.Usage, { id: "custom-id", generatedAt: 1000 });
    expect(report.id).toBe("custom-id");
  });

  it("stamps the report with the supplied generatedAt", () => {
    const report = new KnowledgeAnalyticsReportBuilder()
      .withUsage({ a: 1 })
      .build(KnowledgeReportType.Usage, { generatedAt: 12345 });
    expect(report.generatedAt).toBe(12345);
  });

  it("reset clears every previously supplied section", () => {
    const builder = new KnowledgeAnalyticsReportBuilder().withUsage({ a: 1 });
    builder.reset();
    expect(() => builder.build(KnowledgeReportType.Usage, { generatedAt: 1000 })).toThrow(
      InvalidReportTypeException,
    );
  });

  it("returns `this` from every withX method for fluent chaining", () => {
    const builder = new KnowledgeAnalyticsReportBuilder();
    expect(builder.withUsage({})).toBe(builder);
    expect(builder.withSearch({})).toBe(builder);
    expect(builder.withRetrieval({})).toBe(builder);
    expect(builder.withQuery({})).toBe(builder);
    expect(builder.withEmbedding({})).toBe(builder);
    expect(builder.withGraph({})).toBe(builder);
    expect(builder.withQuality({})).toBe(builder);
    expect(builder.withPerformance({})).toBe(builder);
    expect(builder.withTrend({})).toBe(builder);
    expect(builder.withCost({})).toBe(builder);
    expect(builder.withRecommendation({})).toBe(builder);
  });

  it("reuses the builder across multiple build() calls without clearing state", () => {
    const builder = new KnowledgeAnalyticsReportBuilder().withUsage({ a: 1 });
    const first = builder.build(KnowledgeReportType.Usage, { generatedAt: 1 });
    const second = builder.build(KnowledgeReportType.Usage, { generatedAt: 2 });
    expect(first.sections).toEqual(second.sections);
    expect(first.id).not.toBe(second.id);
  });
});
