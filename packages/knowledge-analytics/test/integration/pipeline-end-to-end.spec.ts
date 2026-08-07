import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";
import { createFixedClock } from "../../src/utils/clock.js";
import { ONE_TO_HUNDRED, ONE_TO_HUNDRED_STATS } from "../helpers/fixtures.js";

describe("End-to-end pipeline via KnowledgeAnalyticsEngine", () => {
  it("flows real recorded data all the way through to the dashboard snapshot", () => {
    const engine = new KnowledgeAnalyticsEngine({ clock: createFixedClock(1000) });

    engine.usage.recordDocumentAdded(10);
    engine.usage.recordDocumentIndexed(8);
    for (const value of ONE_TO_HUNDRED) engine.query.recordQueryTime(value);
    engine.search.recordSearch({ hit: true });
    engine.search.recordSearch({ hit: true });
    engine.search.recordSearch({ hit: false });

    const result = engine.runPipeline();

    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.DocumentCount)).toBe(10);
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.IndexedCount)).toBe(8);
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.AverageQueryTime)).toBe(
      ONE_TO_HUNDRED_STATS.average,
    );
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.P95QueryTime)).toBeCloseTo(
      ONE_TO_HUNDRED_STATS.p95,
      10,
    );
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.HitRate)).toBeCloseTo(2 / 3, 10);
  });

  it("produces a Summary report whose sections match every domain report's content", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(1);
    engine.graph.recordGraphSnapshot({ nodeCount: 10, edgeCount: 12, connectedComponents: 2 });

    const result = engine.runPipeline();
    const summary = result.reports!.find((r) => r.type === KnowledgeReportType.Summary)!;
    const usageReport = result.reports!.find((r) => r.type === KnowledgeReportType.Usage)!;
    const graphReport = result.reports!.find((r) => r.type === KnowledgeReportType.Graph)!;

    expect(summary.sections.usage).toEqual(usageReport.sections.usage);
    expect(summary.sections.graph).toEqual(graphReport.sections.graph);
  });

  it("every report id is retrievable from the engine's report registry after a run", () => {
    const engine = new KnowledgeAnalyticsEngine();
    const result = engine.runPipeline();
    for (const report of result.reports!) {
      expect(engine.getReport(report.id)).toBe(report);
    }
  });

  it("running the pipeline twice accumulates recorded data monotonically", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(1);
    const first = engine.runPipeline();
    engine.usage.recordDocumentAdded(1);
    const second = engine.runPipeline();
    expect(first.dashboardSnapshot!.metric(KnowledgeMetricName.DocumentCount)).toBe(1);
    expect(second.dashboardSnapshot!.metric(KnowledgeMetricName.DocumentCount)).toBe(2);
  });

  it("statistics reflect the cumulative effect of multiple pipeline runs", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.runPipeline();
    engine.runPipeline();
    expect(engine.statistics.snapshot(0).pipelineRunsCompleted).toBe(2);
    expect(engine.statistics.snapshot(0).reportsGenerated).toBe(18);
  });
});
