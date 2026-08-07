import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";

const NON_NUMERIC_METRICS: ReadonlySet<string> = new Set([
  KnowledgeMetricName.TrendAnalysis,
  KnowledgeMetricName.HistoricalMetrics,
  KnowledgeMetricName.MostAccessedKnowledge,
  KnowledgeMetricName.LeastAccessedKnowledge,
]);

describe("KPI map shape for every one of the 30 named metrics", () => {
  const engine = new KnowledgeAnalyticsEngine();
  const result = engine.runPipeline();

  it.each(Object.values(KnowledgeMetricName))("metric %s is present in the kpis map", (id) => {
    expect(result.kpis).toHaveProperty(id);
  });

  it.each(Object.values(KnowledgeMetricName).filter((id) => !NON_NUMERIC_METRICS.has(id)))(
    "numeric metric %s has a finite number value with zero recordings",
    (id) => {
      const value = result.kpis![id];
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value)).toBe(true);
    },
  );

  it.each([...NON_NUMERIC_METRICS])(
    "non-numeric metric %s is present as an array or object, not a number",
    (id) => {
      const value = result.kpis![id];
      expect(typeof value).not.toBe("number");
    },
  );
});
