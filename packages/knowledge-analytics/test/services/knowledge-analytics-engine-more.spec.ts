import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";

describe("KnowledgeAnalyticsEngine additional coverage", () => {
  it("each analytics service on the engine is independent from a second engine instance", () => {
    const first = new KnowledgeAnalyticsEngine();
    const second = new KnowledgeAnalyticsEngine();
    first.usage.recordDocumentAdded(5);
    expect(second.usage.documentCount()).toBe(0);
  });

  it("metricRegistry contains every one of the 30 named metrics after construction", () => {
    const engine = new KnowledgeAnalyticsEngine();
    for (const id of Object.values(KnowledgeMetricName)) {
      expect(engine.metricRegistry.isRegistered(id)).toBe(true);
    }
  });

  it("reportRegistry is empty until a pipeline run has occurred", () => {
    const engine = new KnowledgeAnalyticsEngine();
    expect(engine.reportRegistry.size()).toBe(0);
  });

  it("reportRegistry is populated with 9 reports after one pipeline run", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.runPipeline();
    expect(engine.reportRegistry.size()).toBe(9);
  });

  it("statistics.samplesRecorded is only touched by mirrorToExternalSink, not by direct analytics recording", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(1);
    expect(engine.statistics.snapshot(0).samplesRecorded).toBe(0);
  });

  it("trackTrendSeries is idempotent for the same series name", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.trackTrendSeries("a");
    engine.trackTrendSeries("a");
    engine.trend.recordHistoricalValue("a", 1);
    const result = engine.runPipeline();
    const trend = (result.collected as { trend: { series: Record<string, unknown> } }).trend;
    expect(Object.keys(trend.series)).toEqual(["a"]);
  });
});
