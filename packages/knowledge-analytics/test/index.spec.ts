import { describe, expect, it } from "vitest";

import * as pkg from "../src/index.js";

describe("package barrel (src/index.ts)", () => {
  it("exports KnowledgeAnalyticsEngine", () => {
    expect(pkg.KnowledgeAnalyticsEngine).toBeTypeOf("function");
  });

  it("exports all 11 analytics services", () => {
    expect(pkg.KnowledgeUsageAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeSearchAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeRetrievalAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeQueryAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeEmbeddingAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeGraphAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeQualityAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgePerformanceAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeTrendAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeCostAnalytics).toBeTypeOf("function");
    expect(pkg.KnowledgeRecommendationAnalytics).toBeTypeOf("function");
  });

  it("exports the report/dashboard/summary entities", () => {
    expect(pkg.KnowledgeAnalyticsReport).toBeTypeOf("function");
    expect(pkg.KnowledgeDashboardSnapshot).toBeTypeOf("function");
    expect(pkg.KnowledgeAnalyticsSummary).toBeTypeOf("function");
  });

  it("exports the builder, registries, calculator, and pipeline", () => {
    expect(pkg.KnowledgeAnalyticsReportBuilder).toBeTypeOf("function");
    expect(pkg.KnowledgeMetricRegistry).toBeTypeOf("function");
    expect(pkg.KnowledgeReportRegistry).toBeTypeOf("function");
    expect(pkg.KnowledgeMetricCalculator).toBeTypeOf("function");
    expect(pkg.KnowledgeAnalyticsPipeline).toBeTypeOf("function");
  });

  it("exports every factory", () => {
    expect(pkg.KnowledgeMetricSampleFactory).toBeTypeOf("function");
    expect(pkg.KnowledgeDashboardSnapshotFactory).toBeTypeOf("function");
    expect(pkg.KnowledgeAnalyticsReportFactory).toBeTypeOf("function");
    expect(pkg.KnowledgeAnalyticsConfigurationFactory).toBeTypeOf("function");
  });

  it("exports every error class", () => {
    expect(pkg.KnowledgeAnalyticsException).toBeTypeOf("function");
    expect(pkg.MetricNotFoundException).toBeTypeOf("function");
    expect(pkg.InvalidReportTypeException).toBeTypeOf("function");
    expect(pkg.InvalidSampleException).toBeTypeOf("function");
    expect(pkg.PipelineStageFailureException).toBeTypeOf("function");
    expect(pkg.ReportNotFoundException).toBeTypeOf("function");
  });

  it("exports the event type enum and both event publisher implementations", () => {
    expect(pkg.KnowledgeAnalyticsEventType).toBeTypeOf("object");
    expect(pkg.InMemoryEventPublisher).toBeTypeOf("function");
    expect(pkg.NoOpEventPublisher).toBeTypeOf("function");
  });

  it("exports the value objects and statistics service", () => {
    expect(pkg.KnowledgeMetricSample).toBeTypeOf("function");
    expect(pkg.KnowledgeMetricDefinition).toBeTypeOf("function");
    expect(pkg.KnowledgeAnalyticsConfiguration).toBeTypeOf("function");
    expect(pkg.KnowledgeAnalyticsStatistics).toBeTypeOf("function");
  });

  it("can construct a working engine purely from the barrel export", () => {
    const engine = new pkg.KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(1);
    const result = engine.runPipeline();
    expect(result.reports).toHaveLength(9);
  });
});
