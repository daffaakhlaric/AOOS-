import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { AggregateMetricsStage } from "../../src/pipeline/stages/aggregate-metrics-stage.js";
import { CollectMetricsStage } from "../../src/pipeline/stages/collect-metrics-stage.js";
import { createPipelineContextFixture } from "../helpers/pipeline-context-fixture.js";

describe("AggregateMetricsStage", () => {
  it("throws InvalidSampleException when `collected` has not been populated yet", () => {
    const context = { ...createPipelineContextFixture(), runId: "run_1" };
    expect(() => new AggregateMetricsStage().execute(context)).toThrow(InvalidSampleException);
  });

  it("computes totalSamples across every analytics service", () => {
    const fixture = createPipelineContextFixture();
    fixture.analytics.usage.recordDocumentAdded(1);
    fixture.analytics.search.recordSearch({ hit: true });
    fixture.analytics.search.recordSearch({ hit: false });
    let context = { ...fixture, runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    const result = new AggregateMetricsStage().execute(context);
    expect((result.aggregated as { totalSamples: number }).totalSamples).toBe(3);
  });

  it("computes a per-category sample count breakdown", () => {
    const fixture = createPipelineContextFixture();
    fixture.analytics.usage.recordDocumentAdded(1);
    let context = { ...fixture, runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    const result = new AggregateMetricsStage().execute(context);
    const categoryCounts = (result.aggregated as { categorySampleCounts: Record<string, number> })
      .categorySampleCounts;
    expect(categoryCounts.usage).toBe(1);
    expect(categoryCounts.search).toBe(0);
  });

  it("returns totalSamples 0 when nothing was recorded", () => {
    let context = { ...createPipelineContextFixture(), runId: "run_1" };
    context = new CollectMetricsStage().execute(context);
    const result = new AggregateMetricsStage().execute(context);
    expect((result.aggregated as { totalSamples: number }).totalSamples).toBe(0);
  });
});
