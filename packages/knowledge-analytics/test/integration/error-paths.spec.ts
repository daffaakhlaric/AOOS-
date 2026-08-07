import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { MetricNotFoundException } from "../../src/errors/metric-not-found-exception.js";
import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";
import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";

describe("Error paths surfaced through the public API", () => {
  it("engine.getReport throws ReportNotFoundException for an id that was never generated", () => {
    const engine = new KnowledgeAnalyticsEngine();
    expect(() => engine.getReport("nonexistent")).toThrow(ReportNotFoundException);
  });

  it("recording a query time of NaN throws InvalidSampleException", () => {
    const engine = new KnowledgeAnalyticsEngine();
    expect(() => engine.query.recordQueryTime(Number.NaN)).toThrow(InvalidSampleException);
  });

  it("computing a percentile with no recorded queries returns 0 rather than throwing", () => {
    const engine = new KnowledgeAnalyticsEngine();
    expect(engine.query.p95QueryTime()).toBe(0);
  });

  it("metricRegistry.get throws MetricNotFoundException for an unregistered id after clear()", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.metricRegistry.clear();
    expect(() => engine.metricRegistry.get("search_count")).toThrow(MetricNotFoundException);
  });

  it("a pipeline run still succeeds after the metric registry was cleared (KPIs simply are not registry-synced)", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.metricRegistry.clear();
    expect(() => engine.runPipeline()).not.toThrow();
  });
});
