import { describe, expect, it } from "vitest";

import { KnowledgeTrendAnalytics } from "../../src/analytics/knowledge-trend-analytics.js";
import { createSteppingClock } from "../../src/utils/clock.js";

describe("KnowledgeTrendAnalytics", () => {
  it("counts recorded values per series independently", () => {
    const trend = new KnowledgeTrendAnalytics();
    trend.recordHistoricalValue("search_count", 1);
    trend.recordHistoricalValue("search_count", 2);
    trend.recordHistoricalValue("storage_usage", 100);
    expect(trend.seriesCount("search_count")).toBe(2);
    expect(trend.seriesCount("storage_usage")).toBe(1);
  });

  it("returns 0 seriesCount and trend for an unrecorded series", () => {
    const trend = new KnowledgeTrendAnalytics();
    expect(trend.seriesCount("missing")).toBe(0);
    expect(trend.trendSlope("missing")).toBe(0);
    expect(trend.periodOverPeriodDelta("missing")).toBe(0);
    expect(trend.historicalMetrics("missing")).toEqual([]);
  });

  it("buckets historical values using the configured bucket size and computes the known slope", () => {
    // clock starts at 0 and advances by 500ms per call, bucketSizeMs=1000:
    // t=0 -> 10, t=500 -> 20 (bucket0 avg 15); t=1000 -> 30, t=1500 -> 40 (bucket1 avg 35); t=2000 -> 50 (bucket2 avg 50)
    const trend = new KnowledgeTrendAnalytics({
      clock: createSteppingClock(0, 500),
      bucketSizeMs: 1000,
    });
    trend.recordHistoricalValue("latency", 10);
    trend.recordHistoricalValue("latency", 20);
    trend.recordHistoricalValue("latency", 30);
    trend.recordHistoricalValue("latency", 40);
    trend.recordHistoricalValue("latency", 50);

    const buckets = trend.historicalMetrics("latency");
    expect(buckets.map((b) => b.average)).toEqual([15, 35, 50]);
    expect(trend.trendSlope("latency")).toBeCloseTo(17.5, 10);
    expect(trend.periodOverPeriodDelta("latency")).toBeCloseTo(15 / 35, 10);
  });

  it("summary aggregates trendSlope/periodOverPeriodDelta/seriesCount per requested series", () => {
    const trend = new KnowledgeTrendAnalytics({
      clock: createSteppingClock(0, 1000),
      bucketSizeMs: 1000,
    });
    trend.recordHistoricalValue("a", 1);
    trend.recordHistoricalValue("a", 2);
    const result = trend.summary(["a", "b"]);
    expect(result).toHaveProperty("series");
    const series = (result as { series: Record<string, unknown> }).series;
    expect(series.a).toMatchObject({ seriesCount: 2 });
    expect(series.b).toMatchObject({ seriesCount: 0 });
  });

  it("summary with no series names returns an empty series map", () => {
    const trend = new KnowledgeTrendAnalytics();
    expect(trend.summary()).toEqual({ series: {} });
  });
});
