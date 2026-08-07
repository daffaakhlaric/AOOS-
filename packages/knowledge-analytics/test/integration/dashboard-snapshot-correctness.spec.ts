import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";

describe("Dashboard snapshot correctness", () => {
  it("captures the exact hit rate at the moment the pipeline ran", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.search.recordSearch({ hit: true });
    engine.search.recordSearch({ hit: true });
    engine.search.recordSearch({ hit: false });
    engine.search.recordSearch({ hit: false });
    const result = engine.runPipeline();
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.HitRate)).toBe(0.5);
  });

  it("does not retroactively update after further recordings without another pipeline run", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(1);
    const result = engine.runPipeline();
    engine.usage.recordDocumentAdded(100);
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.DocumentCount)).toBe(1);
  });

  it("engine.latestDashboard() reflects the most recent pipeline run only", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.usage.recordDocumentAdded(1);
    engine.runPipeline();
    engine.usage.recordDocumentAdded(1);
    engine.runPipeline();
    expect(engine.latestDashboard().metric(KnowledgeMetricName.DocumentCount)).toBe(2);
  });

  it("includes graph metrics accurately", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.graph.recordGraphSnapshot({ nodeCount: 8, edgeCount: 4, connectedComponents: 2 });
    const result = engine.runPipeline();
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.GraphNodeCount)).toBe(8);
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.AverageGraphDegree)).toBe(1);
  });

  it("excludes array/object-shaped metrics from the snapshot", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.recommendation.recordAccess("a");
    const result = engine.runPipeline();
    expect(Object.keys(result.dashboardSnapshot!.metrics)).not.toContain(
      KnowledgeMetricName.MostAccessedKnowledge,
    );
  });
});
