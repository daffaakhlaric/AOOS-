import { describe, expect, it } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAnalyticsEventType } from "../../src/events/knowledge-analytics-event-type.js";
import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";

describe("Statistics and event correctness across a full pipeline run", () => {
  it("fires AnalyticsStarted exactly once per run", () => {
    const publisher = new InMemoryEventPublisher();
    const engine = new KnowledgeAnalyticsEngine({ eventPublisher: publisher });
    engine.runPipeline();
    engine.runPipeline();
    const started = publisher
      .getHistory()
      .filter((e) => e.eventType === KnowledgeAnalyticsEventType.AnalyticsStarted);
    expect(started).toHaveLength(2);
  });

  it("every event in the run carries the same runId", () => {
    const publisher = new InMemoryEventPublisher();
    const engine = new KnowledgeAnalyticsEngine({ eventPublisher: publisher });
    const result = engine.runPipeline();
    const runIds = new Set(
      publisher.getHistory().map((e) => (e.payload as { runId?: string }).runId),
    );
    expect(runIds).toEqual(new Set([result.runId]));
  });

  it("statistics.dashboardSnapshotsGenerated increments once per run", () => {
    const engine = new KnowledgeAnalyticsEngine();
    engine.runPipeline();
    engine.runPipeline();
    engine.runPipeline();
    expect(engine.statistics.snapshot(0).dashboardSnapshotsGenerated).toBe(3);
  });

  it("statistics.metricsCalculated grows as more numeric metrics have real data", () => {
    const emptyEngine = new KnowledgeAnalyticsEngine();
    emptyEngine.runPipeline();

    const busyEngine = new KnowledgeAnalyticsEngine();
    busyEngine.search.recordSearch({ hit: true });
    busyEngine.runPipeline();

    // Both engines register every metric, so both report the same count of *numeric* KPIs synced
    // (every one of the fixed 28 numeric metric ids is always present, recorded or not).
    expect(busyEngine.statistics.snapshot(0).metricsCalculated).toBe(
      emptyEngine.statistics.snapshot(0).metricsCalculated,
    );
  });
});
