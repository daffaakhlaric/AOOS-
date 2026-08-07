import { describe, expect, it } from "vitest";

import { CollectMetricsStage } from "../../src/pipeline/stages/collect-metrics-stage.js";
import { createPipelineContextFixture } from "../helpers/pipeline-context-fixture.js";

describe("CollectMetricsStage", () => {
  it("collects a summary from every one of the 11 analytics services", () => {
    const context = { ...createPipelineContextFixture(), runId: "run_1" };
    const result = new CollectMetricsStage().execute(context);
    expect(result.collected).toBeDefined();
    const keys = Object.keys(result.collected!);
    expect(keys.sort()).toEqual(
      [
        "usage",
        "search",
        "retrieval",
        "query",
        "embedding",
        "graph",
        "quality",
        "performance",
        "trend",
        "cost",
        "recommendation",
      ].sort(),
    );
  });

  it("reflects data recorded before the stage runs", () => {
    const fixture = createPipelineContextFixture();
    fixture.analytics.usage.recordDocumentAdded(5);
    const context = { ...fixture, runId: "run_1" };
    const result = new CollectMetricsStage().execute(context);
    expect((result.collected!.usage as { documentCount: number }).documentCount).toBe(5);
  });

  it("includes the configured trend series names in the trend section", () => {
    const fixture = createPipelineContextFixture({ trendSeries: { names: ["search_count"] } });
    fixture.analytics.trend.recordHistoricalValue("search_count", 10);
    const context = { ...fixture, runId: "run_1" };
    const result = new CollectMetricsStage().execute(context);
    const trend = result.collected!.trend as { series: Record<string, unknown> };
    expect(trend.series).toHaveProperty("search_count");
  });

  it("returns a new context object rather than mutating the input", () => {
    const context = { ...createPipelineContextFixture(), runId: "run_1" };
    const result = new CollectMetricsStage().execute(context);
    expect(result).not.toBe(context);
    expect(context.collected).toBeUndefined();
  });
});
