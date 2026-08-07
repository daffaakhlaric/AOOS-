import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";

const DOMAIN_TYPES = [
  KnowledgeReportType.Summary,
  KnowledgeReportType.Usage,
  KnowledgeReportType.Performance,
  KnowledgeReportType.Graph,
  KnowledgeReportType.Quality,
  KnowledgeReportType.Embedding,
  KnowledgeReportType.Trend,
  KnowledgeReportType.Cost,
  KnowledgeReportType.Recommendation,
];

describe("Every domain report type round-trips through the engine's report registry", () => {
  const engine = new KnowledgeAnalyticsEngine();
  const result = engine.runPipeline();

  it("produces exactly one report per domain type (9 total)", () => {
    expect(result.reports).toHaveLength(DOMAIN_TYPES.length);
  });

  it.each(DOMAIN_TYPES)("a %s report was generated this run", (type) => {
    expect(result.reports!.some((r) => r.type === type)).toBe(true);
  });

  it.each(DOMAIN_TYPES)("the %s report is retrievable from the engine by id", (type) => {
    const report = result.reports!.find((r) => r.type === type)!;
    expect(engine.getReport(report.id)).toBe(report);
  });

  it.each(DOMAIN_TYPES)("the %s report has a non-empty id and a generatedAt timestamp", (type) => {
    const report = result.reports!.find((r) => r.type === type)!;
    expect(report.id.length).toBeGreaterThan(0);
    expect(typeof report.generatedAt).toBe("number");
  });
});
