import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";
import { createFixedClock } from "../../src/utils/clock.js";
import { KnowledgeAnalyticsConfiguration } from "../../src/value-objects/knowledge-analytics-configuration.js";

describe("KnowledgeAnalyticsEngine construction", () => {
  it("generates an id automatically when none is supplied", () => {
    expect(new KnowledgeAnalyticsEngine().id.startsWith("knowledge-analytics-engine_")).toBe(true);
  });

  it("uses a supplied id verbatim", () => {
    expect(new KnowledgeAnalyticsEngine({ id: "custom" }).id).toBe("custom");
  });

  it("applies default configuration when none is supplied", () => {
    expect(new KnowledgeAnalyticsEngine().configuration.dashboardRefreshCadenceMs).toBe(60_000);
  });

  it("pre-registers all 30 named metrics in the registry", () => {
    const engine = new KnowledgeAnalyticsEngine();
    expect(engine.metricRegistry.size()).toBe(Object.values(KnowledgeMetricName).length);
  });

  it("wires every one of the 11 analytics services", () => {
    const engine = new KnowledgeAnalyticsEngine();
    expect(engine.usage).toBeDefined();
    expect(engine.search).toBeDefined();
    expect(engine.retrieval).toBeDefined();
    expect(engine.query).toBeDefined();
    expect(engine.embedding).toBeDefined();
    expect(engine.graph).toBeDefined();
    expect(engine.quality).toBeDefined();
    expect(engine.performance).toBeDefined();
    expect(engine.trend).toBeDefined();
    expect(engine.cost).toBeDefined();
    expect(engine.recommendation).toBeDefined();
  });

  it("wires each analytics service to publish into the shared metric registry", () => {
    const engine = new KnowledgeAnalyticsEngine({ clock: createFixedClock(1000) });
    engine.search.recordSearch({ hit: true });
    expect(engine.metricRegistry.get(KnowledgeMetricName.SearchCount).currentValue).toBe(1);
  });

  it("applies configuration.trendBucketSizeMs to the trend analytics service", () => {
    const engine = new KnowledgeAnalyticsEngine({
      clock: createFixedClock(0),
      configuration: new KnowledgeAnalyticsConfiguration({ trendBucketSizeMs: 500 }),
    });
    engine.trend.recordHistoricalValue("s", 1);
    expect(
      engine.trend.historicalMetrics("s")[0]!.end - engine.trend.historicalMetrics("s")[0]!.start,
    ).toBe(500);
  });
});

describe("KnowledgeAnalyticsEngine module lifecycle", () => {
  it("is not started by default", () => {
    expect(new KnowledgeAnalyticsEngine().isStarted()).toBe(false);
  });

  it("start() marks the engine started", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.start();
    expect(engine.isStarted()).toBe(true);
  });

  it("stop() marks the engine stopped", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.start();
    engine.stop();
    expect(engine.isStarted()).toBe(false);
  });
});
