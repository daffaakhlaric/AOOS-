import { beforeEach, describe, expect, it } from "vitest";

import { PipelineStageFailureException } from "../../src/errors/pipeline-stage-failure-exception.js";
import { KnowledgeIntelligencePipeline } from "../../src/pipeline/knowledge-intelligence-pipeline.js";
import type { PipelineStage } from "../../src/pipeline/pipeline-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../helpers/fixtures.js";
import { makeServices } from "../helpers/pipeline-helpers.js";

describe("KnowledgeIntelligencePipeline", () => {
  beforeEach(() => resetFixtureState());

  it("runs all 11 default stages and produces a full context", () => {
    const clock = makeClock(1000);
    const services = makeServices(clock, makeConfig());
    const pipeline = new KnowledgeIntelligencePipeline();
    const context = pipeline.run(
      { items: [makeItem({ id: "a", lastUpdatedAt: 1000, contentLength: 500 })] },
      services,
    );
    expect(context.report).toBeDefined();
    expect(context.statistics).toBeDefined();
    expect(context.runId).toMatch(/^run-/);
  });

  it("wraps a thrown stage error in PipelineStageFailureException", () => {
    const clock = makeClock(0);
    const services = makeServices(clock, makeConfig());
    const failingStage: PipelineStage = {
      name: "boom-stage",
      execute: () => {
        throw new Error("boom");
      },
    };
    const pipeline = new KnowledgeIntelligencePipeline([failingStage]);
    expect(() => pipeline.run({ items: [] }, services)).toThrow(PipelineStageFailureException);
  });

  it("does not re-wrap a PipelineStageFailureException thrown by a stage", () => {
    const clock = makeClock(0);
    const services = makeServices(clock, makeConfig());
    const original = new PipelineStageFailureException("inner", undefined);
    const failingStage: PipelineStage = {
      name: "boom-stage",
      execute: () => {
        throw original;
      },
    };
    const pipeline = new KnowledgeIntelligencePipeline([failingStage]);
    try {
      pipeline.run({ items: [] }, services);
      expect.unreachable();
    } catch (error) {
      expect(error).toBe(original);
    }
  });

  it("supports custom stage lists", () => {
    const clock = makeClock(0);
    const services = makeServices(clock, makeConfig());
    let executed = false;
    const stage: PipelineStage = {
      name: "custom",
      execute: (ctx) => {
        executed = true;
        return ctx;
      },
    };
    new KnowledgeIntelligencePipeline([stage]).run({ items: [] }, services);
    expect(executed).toBe(true);
  });
});
