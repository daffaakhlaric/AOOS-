import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { CalculateKPIsStage } from "../../src/pipeline/stages/calculate-kpis-stage.js";
import { CollectMetricsStage } from "../../src/pipeline/stages/collect-metrics-stage.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";
import { createPipelineContextFixture } from "../helpers/pipeline-context-fixture.js";

describe("CalculateKPIsStage", () => {
  it("throws InvalidSampleException when `collected` has not been populated yet", () => {
    const context = { ...createPipelineContextFixture(), runId: "run_1" };
    expect(() => new CalculateKPIsStage().execute(context)).toThrow(InvalidSampleException);
  });

  it("flattens every one of the 30 named metrics into the kpis map", () => {
    let context = { ...createPipelineContextFixture(), runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    const result = new CalculateKPIsStage().execute(context);
    const kpiKeys = Object.keys(result.kpis!);
    for (const metricName of Object.values(KnowledgeMetricName)) {
      expect(kpiKeys).toContain(metricName);
    }
  });

  it("computes an accurate numeric KPI from recorded search data", () => {
    const fixture = createPipelineContextFixture();
    fixture.analytics.search.recordSearch({ hit: true });
    fixture.analytics.search.recordSearch({ hit: true });
    fixture.analytics.search.recordSearch({ hit: false });
    fixture.analytics.search.recordSearch({ hit: false });
    let context = { ...fixture, runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    const result = new CalculateKPIsStage().execute(context);
    expect(result.kpis![KnowledgeMetricName.HitRate]).toBe(0.5);
    expect(result.kpis![KnowledgeMetricName.SearchCount]).toBe(4);
  });

  it("syncs every numeric KPI into the metric registry", () => {
    const fixture = createPipelineContextFixture();
    fixture.analytics.search.recordSearch({ hit: true });
    let context = { ...fixture, runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    new CalculateKPIsStage().execute(context);
    expect(context.metricRegistry.get(KnowledgeMetricName.SearchCount).currentValue).toBe(1);
  });

  it("increments statistics.metricsCalculated by the number of numeric KPIs synced", () => {
    let context = { ...createPipelineContextFixture(), runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    new CalculateKPIsStage().execute(context);
    const snapshot = context.statistics.snapshot(0);
    expect(snapshot.metricsCalculated).toBeGreaterThan(0);
  });

  it("skips registry sync for a KPI whose metric id was never registered", () => {
    const fixture = createPipelineContextFixture();
    fixture.metricRegistry.clear();
    let context = { ...fixture, runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    expect(() => new CalculateKPIsStage().execute(context)).not.toThrow();
  });

  it("includes non-numeric metrics (trend, recommendation rankings) in the kpis map without registry sync", () => {
    let context = { ...createPipelineContextFixture(), runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    const result = new CalculateKPIsStage().execute(context);
    expect(result.kpis![KnowledgeMetricName.MostAccessedKnowledge]).toEqual([]);
  });
});
