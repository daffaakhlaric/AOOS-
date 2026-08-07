import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { CalculateKPIsStage } from "../../src/pipeline/stages/calculate-kpis-stage.js";
import { CollectMetricsStage } from "../../src/pipeline/stages/collect-metrics-stage.js";
import { GenerateDashboardSnapshotStage } from "../../src/pipeline/stages/generate-dashboard-snapshot-stage.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";
import { createPipelineContextFixture } from "../helpers/pipeline-context-fixture.js";

describe("GenerateDashboardSnapshotStage", () => {
  it("throws InvalidSampleException when `kpis` has not been populated yet", () => {
    const context = { ...createPipelineContextFixture(), runId: "run_1" };
    expect(() => new GenerateDashboardSnapshotStage().execute(context)).toThrow(
      InvalidSampleException,
    );
  });

  it("includes only the numeric KPIs in the snapshot's metrics", () => {
    const fixture = createPipelineContextFixture();
    fixture.analytics.search.recordSearch({ hit: true });
    let context = { ...fixture, runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    context = new CalculateKPIsStage().execute(context);
    const result = new GenerateDashboardSnapshotStage().execute(context);
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.SearchCount)).toBe(1);
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.TrendAnalysis)).toBeUndefined();
    expect(
      result.dashboardSnapshot!.metric(KnowledgeMetricName.MostAccessedKnowledge),
    ).toBeUndefined();
  });

  it("increments statistics.dashboardSnapshotsGenerated", () => {
    let context = { ...createPipelineContextFixture(), runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    context = new CalculateKPIsStage().execute(context);
    new GenerateDashboardSnapshotStage().execute(context);
    expect(context.statistics.snapshot(0).dashboardSnapshotsGenerated).toBe(1);
  });

  it("stamps generatedAt from the context clock", () => {
    let context = { ...createPipelineContextFixture(), runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    context = new CalculateKPIsStage().execute(context);
    const result = new GenerateDashboardSnapshotStage().execute(context);
    expect(result.dashboardSnapshot!.generatedAt).toBe(context.clock());
  });
});
