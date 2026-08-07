import { describe, expect, it } from "vitest";

import { KnowledgeTrendAnalytics } from "../../src/analytics/knowledge-trend-analytics.js";
import { createSteppingClock } from "../../src/utils/clock.js";

describe("KnowledgeTrendAnalytics edge cases", () => {
  it("supports multiple independent series simultaneously", () => {
    const trend = new KnowledgeTrendAnalytics({
      clock: createSteppingClock(0, 1000),
      bucketSizeMs: 1000,
    });
    trend.recordHistoricalValue("a", 1);
    trend.recordHistoricalValue("b", 100);
    expect(trend.historicalMetrics("a")[0]!.average).toBe(1);
    expect(trend.historicalMetrics("b")[0]!.average).toBe(100);
  });

  it("periodOverPeriodDelta is 0 for a single-bucket series", () => {
    const trend = new KnowledgeTrendAnalytics();
    trend.recordHistoricalValue("a", 5);
    expect(trend.periodOverPeriodDelta("a")).toBe(0);
  });

  it("trendSlope is 0 for a flat series across multiple buckets", () => {
    const trend = new KnowledgeTrendAnalytics({
      clock: createSteppingClock(0, 1000),
      bucketSizeMs: 1000,
    });
    trend.recordHistoricalValue("a", 10);
    trend.recordHistoricalValue("a", 10);
    trend.recordHistoricalValue("a", 10);
    expect(trend.trendSlope("a")).toBe(0);
  });

  it("uses a custom bucket size when supplied", () => {
    const trend = new KnowledgeTrendAnalytics({
      clock: createSteppingClock(0, 100),
      bucketSizeMs: 200,
    });
    trend.recordHistoricalValue("a", 1);
    trend.recordHistoricalValue("a", 2);
    expect(trend.historicalMetrics("a")).toHaveLength(1);
  });
});
