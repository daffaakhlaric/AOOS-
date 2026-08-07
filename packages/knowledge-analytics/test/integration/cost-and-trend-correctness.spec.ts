import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import type { Clock } from "../../src/types/common.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";
import { KnowledgeAnalyticsConfiguration } from "../../src/value-objects/knowledge-analytics-configuration.js";

/**
 * Because the engine registers a metric for every analytics service, each `recordX` call ticks the
 * clock twice (once for the sample timestamp, once for the registry's `updatedAt` when `publish()`
 * syncs it) — so a plain stepping clock would double-advance. This queue clock lets the test
 * control exactly which timestamps the *samples* land on regardless of how many extra ticks
 * `publish()` consumes in between.
 */
function createQueueClock(sampleTimestamps: readonly number[]): Clock {
  const queue = sampleTimestamps.flatMap((t) => [t, t]);
  let index = 0;
  return () => queue[Math.min(index++, queue.length - 1)]!;
}

describe("Cost and trend correctness through the engine", () => {
  it("total cost combines embedding and query cost exactly", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.cost.recordEmbeddingCost(3.25);
    engine.cost.recordQueryCost(1.75);
    const result = engine.runPipeline();
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.EmbeddingCost)).toBeCloseTo(
      3.25,
      10,
    );
    expect(result.dashboardSnapshot!.metric(KnowledgeMetricName.QueryCost)).toBeCloseTo(1.75, 10);
  });

  it("trend slope through the engine matches the hand-verified known dataset", () => {
    const engine = new KnowledgeAnalyticsEngine({
      clock: createQueueClock([0, 500, 1000, 1500, 2000]),
      configuration: new KnowledgeAnalyticsConfiguration({ trendBucketSizeMs: 1000 }),
    });
    engine.trackTrendSeries("latency");
    engine.trend.recordHistoricalValue("latency", 10);
    engine.trend.recordHistoricalValue("latency", 20);
    engine.trend.recordHistoricalValue("latency", 30);
    engine.trend.recordHistoricalValue("latency", 40);
    engine.trend.recordHistoricalValue("latency", 50);
    // Same known dataset as test/utils/time-bucket.spec.ts: slope 17.5 with a 1000ms bucket.
    expect(engine.trend.trendSlope("latency")).toBeCloseTo(17.5, 10);
  });

  it("recommendation ranking survives a full pipeline run unchanged", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.recommendation.recordAccess("hot", 50);
    engine.recommendation.recordAccess("cold", 1);
    const result = engine.runPipeline();
    const recommendationSection = result.reports!.find((r) => r.type.includes("recommendation"))!
      .sections.recommendation as { mostAccessedKnowledge: { knowledgeId: string }[] };
    expect(recommendationSection.mostAccessedKnowledge[0]!.knowledgeId).toBe("hot");
  });
});
