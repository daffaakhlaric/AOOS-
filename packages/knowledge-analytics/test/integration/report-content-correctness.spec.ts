import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";

/**
 * Every one of the 9 report types produced by the pipeline must have genuinely different,
 * correctly-populated content — not the same generic shape with a different label.
 */
describe("Report content differs meaningfully per report type", () => {
  it("produces 9 distinct single-section (or all-section) reports", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(1);
    engine.search.recordSearch({ hit: true });
    engine.retrieval.recordRetrieval({ cacheHit: true });
    engine.query.recordQueryTime(10);
    engine.embedding.recordEmbedding({ durationMs: 5, tokens: 10 });
    engine.graph.recordGraphSnapshot({ nodeCount: 2, edgeCount: 1, connectedComponents: 1 });
    engine.quality.recordQualityCheck({ succeeded: true });
    engine.performance.recordRetrievalTime(20);
    engine.cost.recordEmbeddingCost(1);
    engine.recommendation.recordAccess("k1");

    const result = engine.runPipeline();
    const byType = new Map(result.reports!.map((r) => [r.type, r]));

    expect(Object.keys(byType.get(KnowledgeReportType.Usage)!.sections)).toEqual(["usage"]);
    expect(Object.keys(byType.get(KnowledgeReportType.Performance)!.sections)).toEqual([
      "performance",
    ]);
    expect(Object.keys(byType.get(KnowledgeReportType.Graph)!.sections)).toEqual(["graph"]);
    expect(Object.keys(byType.get(KnowledgeReportType.Quality)!.sections)).toEqual(["quality"]);
    expect(Object.keys(byType.get(KnowledgeReportType.Embedding)!.sections)).toEqual(["embedding"]);
    expect(Object.keys(byType.get(KnowledgeReportType.Trend)!.sections)).toEqual(["trend"]);
    expect(Object.keys(byType.get(KnowledgeReportType.Cost)!.sections)).toEqual(["cost"]);
    expect(Object.keys(byType.get(KnowledgeReportType.Recommendation)!.sections)).toEqual([
      "recommendation",
    ]);
    expect(Object.keys(byType.get(KnowledgeReportType.Summary)!.sections).sort()).toEqual(
      [
        "usage",
        "search",
        "retrieval",
        "query",
        "embedding",
        "graph",
        "quality",
        "performance",
        "trend",
        "cost",
        "recommendation",
      ].sort(),
    );
  });

  it("the Usage report reflects actual recorded usage numbers, not zeros", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(3);
    engine.usage.recordDocumentIndexed(2);
    const result = engine.runPipeline();
    const usageReport = result.reports!.find((r) => r.type === KnowledgeReportType.Usage)!;
    expect(usageReport.sections.usage).toMatchObject({ documentCount: 3, indexedCount: 2 });
  });

  it("the Cost report reflects actual recorded cost numbers, not zeros", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.cost.recordEmbeddingCost(2.5);
    engine.cost.recordQueryCost(1.5);
    const result = engine.runPipeline();
    const costReport = result.reports!.find((r) => r.type === KnowledgeReportType.Cost)!;
    expect(costReport.sections.cost).toMatchObject({
      totalEmbeddingCost: 2.5,
      totalQueryCost: 1.5,
      totalCost: 4,
    });
  });

  it("the Recommendation report reflects actual ranking data, not an empty list", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.recommendation.recordAccess("popular", 100);
    engine.recommendation.recordAccess("rare", 1);
    const result = engine.runPipeline();
    const recReport = result.reports!.find((r) => r.type === KnowledgeReportType.Recommendation)!;
    const section = recReport.sections.recommendation as {
      mostAccessedKnowledge: { knowledgeId: string }[];
    };
    expect(section.mostAccessedKnowledge[0]!.knowledgeId).toBe("popular");
  });
});
