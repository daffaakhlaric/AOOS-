import { describe, expect, it, vi } from "vitest";

import { PipelineStageFailureException } from "../../src/errors/pipeline-stage-failure-exception.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAnalyticsEventType } from "../../src/events/knowledge-analytics-event-type.js";
import { KnowledgeAnalyticsPipeline } from "../../src/pipeline/knowledge-analytics-pipeline.js";
import type { PipelineStage } from "../../src/pipeline/pipeline-stage.js";
import { createPipelineContextFixture } from "../helpers/pipeline-context-fixture.js";

describe("KnowledgeAnalyticsPipeline", () => {
  it("runs all 6 default stages, producing collected/aggregated/kpis/reports/dashboardSnapshot", () => {
    const pipeline = new KnowledgeAnalyticsPipeline();
    const result = pipeline.run(createPipelineContextFixture());
    expect(result.collected).toBeDefined();
    expect(result.aggregated).toBeDefined();
    expect(result.kpis).toBeDefined();
    expect(result.reports).toHaveLength(9);
    expect(result.dashboardSnapshot).toBeDefined();
  });

  it("generates a fresh runId for each run", () => {
    const pipeline = new KnowledgeAnalyticsPipeline();
    const first = pipeline.run(createPipelineContextFixture());
    const second = pipeline.run(createPipelineContextFixture());
    expect(first.runId).not.toBe(second.runId);
  });

  it("publishes AnalyticsStarted before AnalyticsCompleted on success", () => {
    const publisher = new InMemoryEventPublisher();
    new KnowledgeAnalyticsPipeline().run(
      createPipelineContextFixture({ eventPublisher: publisher }),
    );
    const types = publisher.getHistory().map((e) => e.eventType);
    expect(types[0]).toBe(KnowledgeAnalyticsEventType.AnalyticsStarted);
    expect(types).toContain(KnowledgeAnalyticsEventType.AnalyticsCompleted);
  });

  it("increments statistics.pipelineRunsCompleted on success", () => {
    const context = createPipelineContextFixture();
    new KnowledgeAnalyticsPipeline().run(context);
    expect(context.statistics.snapshot(0).pipelineRunsCompleted).toBe(1);
  });

  it("wraps a failing stage in PipelineStageFailureException", () => {
    const failingStage: PipelineStage = {
      name: "CollectMetrics",
      execute() {
        throw new Error("boom");
      },
    };
    const pipeline = new KnowledgeAnalyticsPipeline([failingStage]);
    expect(() => pipeline.run(createPipelineContextFixture())).toThrow(
      PipelineStageFailureException,
    );
  });

  it("includes the failing stage's name in the wrapped exception", () => {
    const failingStage: PipelineStage = {
      name: "CustomStage",
      execute() {
        throw new Error("boom");
      },
    };
    const pipeline = new KnowledgeAnalyticsPipeline([failingStage]);
    try {
      pipeline.run(createPipelineContextFixture());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineStageFailureException);
      expect((error as PipelineStageFailureException).context).toEqual({
        stageName: "CustomStage",
      });
    }
  });

  it("publishes AnalyticsFailed (not AnalyticsCompleted) when a stage throws", () => {
    const publisher = new InMemoryEventPublisher();
    const failingStage: PipelineStage = {
      name: "CollectMetrics",
      execute() {
        throw new Error("boom");
      },
    };
    const pipeline = new KnowledgeAnalyticsPipeline([failingStage]);
    expect(() =>
      pipeline.run(createPipelineContextFixture({ eventPublisher: publisher })),
    ).toThrow();
    const types = publisher.getHistory().map((e) => e.eventType);
    expect(types).toContain(KnowledgeAnalyticsEventType.AnalyticsFailed);
    expect(types).not.toContain(KnowledgeAnalyticsEventType.AnalyticsCompleted);
  });

  it("increments statistics.pipelineRunsFailed when a stage throws", () => {
    const context = createPipelineContextFixture();
    const failingStage: PipelineStage = {
      name: "CollectMetrics",
      execute() {
        throw new Error("boom");
      },
    };
    const pipeline = new KnowledgeAnalyticsPipeline([failingStage]);
    expect(() => pipeline.run(context)).toThrow();
    expect(context.statistics.snapshot(0).pipelineRunsFailed).toBe(1);
  });

  it("accepts a custom stage list and runs stages in the given order", () => {
    const order: string[] = [];
    const stageA: PipelineStage = {
      name: "A",
      execute(context) {
        order.push("A");
        return context;
      },
    };
    const stageB: PipelineStage = {
      name: "B",
      execute(context) {
        order.push("B");
        return context;
      },
    };
    new KnowledgeAnalyticsPipeline([stageA, stageB]).run(createPipelineContextFixture());
    expect(order).toEqual(["A", "B"]);
  });

  it("re-throws a non-Error thrown value wrapped in PipelineStageFailureException", () => {
    const failingStage: PipelineStage = {
      name: "WeirdStage",
      execute() {
        throw "plain string failure";
      },
    };
    const pipeline = new KnowledgeAnalyticsPipeline([failingStage]);
    expect(() => pipeline.run(createPipelineContextFixture())).toThrow(
      PipelineStageFailureException,
    );
  });

  it("passes context through unmodified stages using vi.fn spies to confirm each stage is called once", () => {
    const spyA = vi.fn((context) => context);
    const spyB = vi.fn((context) => context);
    const stageA: PipelineStage = { name: "A", execute: spyA };
    const stageB: PipelineStage = { name: "B", execute: spyB };
    new KnowledgeAnalyticsPipeline([stageA, stageB]).run(createPipelineContextFixture());
    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
  });
});
