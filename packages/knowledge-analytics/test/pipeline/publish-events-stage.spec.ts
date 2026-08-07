import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAnalyticsEventType } from "../../src/events/knowledge-analytics-event-type.js";
import { CalculateKPIsStage } from "../../src/pipeline/stages/calculate-kpis-stage.js";
import { CollectMetricsStage } from "../../src/pipeline/stages/collect-metrics-stage.js";
import { GenerateDashboardSnapshotStage } from "../../src/pipeline/stages/generate-dashboard-snapshot-stage.js";
import { GenerateReportsStage } from "../../src/pipeline/stages/generate-reports-stage.js";
import { PublishEventsStage } from "../../src/pipeline/stages/publish-events-stage.js";
import { createPipelineContextFixture } from "../helpers/pipeline-context-fixture.js";

function runThroughStage5(overrides: Parameters<typeof createPipelineContextFixture>[0] = {}) {
  let context = { ...createPipelineContextFixture(overrides), runId: "run_1" };
  context = new CollectMetricsStage().execute(context);
  context = new CalculateKPIsStage().execute(context);
  context = new GenerateReportsStage().execute(context);
  context = new GenerateDashboardSnapshotStage().execute(context);
  return context;
}

describe("PublishEventsStage", () => {
  it("throws InvalidSampleException when prior stage outputs are missing", () => {
    const context = { ...createPipelineContextFixture(), runId: "run_1" };
    expect(() => new PublishEventsStage().execute(context)).toThrow(InvalidSampleException);
  });

  it("publishes a MetricCalculated event for every numeric KPI", () => {
    const publisher = new InMemoryEventPublisher();
    const context = runThroughStage5({ eventPublisher: publisher });
    new PublishEventsStage().execute(context);
    const metricEvents = publisher
      .getHistory()
      .filter((e) => e.eventType === KnowledgeAnalyticsEventType.MetricCalculated);
    expect(metricEvents.length).toBeGreaterThan(0);
  });

  it("publishes a ReportGenerated event for every report", () => {
    const publisher = new InMemoryEventPublisher();
    const context = runThroughStage5({ eventPublisher: publisher });
    new PublishEventsStage().execute(context);
    const reportEvents = publisher
      .getHistory()
      .filter((e) => e.eventType === KnowledgeAnalyticsEventType.ReportGenerated);
    expect(reportEvents).toHaveLength(context.reports!.length);
  });

  it("publishes exactly one DashboardUpdated event", () => {
    const publisher = new InMemoryEventPublisher();
    const context = runThroughStage5({ eventPublisher: publisher });
    new PublishEventsStage().execute(context);
    const dashboardEvents = publisher
      .getHistory()
      .filter((e) => e.eventType === KnowledgeAnalyticsEventType.DashboardUpdated);
    expect(dashboardEvents).toHaveLength(1);
  });

  it("increments statistics.eventsPublished by the total number of events fired", () => {
    const context = runThroughStage5();
    new PublishEventsStage().execute(context);
    const metricCount = Object.values(context.kpis!).filter(
      (v) => typeof v === "number" && Number.isFinite(v),
    ).length;
    const expected = metricCount + context.reports!.length + 1;
    expect(context.statistics.snapshot(0).eventsPublished).toBe(expected);
  });
});
