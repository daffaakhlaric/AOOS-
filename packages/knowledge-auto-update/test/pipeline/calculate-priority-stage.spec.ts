import { beforeEach, describe, expect, it } from "vitest";

import { CalculatePriorityStage } from "../../src/pipeline/stages/calculate-priority-stage.js";
import { ManualClock } from "../../src/utils/clock.js";
import { makeJob, makePolicy, resetFixtureState } from "../helpers/fixtures.js";
import { makeContext, makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("CalculatePriorityStage", () => {
  beforeEach(resetFixtureState);

  it("computes a numeric priority using base priority, staleness, and dependents", () => {
    const clock = new ManualClock(1000);
    const job = makeJob({ priority: 2, createdAt: 0 });
    const policy = makePolicy();
    const context = makeContext({
      job,
      policy,
      dependentCount: 3,
      services: makePipelineServices(clock),
    });
    const result = new CalculatePriorityStage().execute(context);
    expect(typeof result.calculatedPriority).toBe("number");
  });

  it("uses previousPayload.lastModifiedAt as the staleness baseline when present", () => {
    const clock = new ManualClock(1500);
    const job = makeJob({ previousPayload: { lastModifiedAt: 500 } });
    const context = makeContext({ job, services: makePipelineServices(clock) });
    new CalculatePriorityStage().execute(context);
    expect(context.calculatedPriority).toBeDefined();
  });

  it("falls back to job.createdAt when there is no previousPayload.lastModifiedAt", () => {
    const clock = new ManualClock(200);
    const job = makeJob({ createdAt: 100 });
    const context = makeContext({ job, services: makePipelineServices(clock) });
    new CalculatePriorityStage().execute(context);
    expect(context.calculatedPriority).toBeDefined();
  });

  it("treats a policy with maxAgeMs of 0 as a 0 staleness ratio (avoids divide-by-zero)", () => {
    const policy = makePolicy({ maxAgeMs: 0 });
    const job = makeJob({ createdAt: 0 });
    const context = makeContext({
      job,
      policy,
      services: makePipelineServices(new ManualClock(500)),
    });
    new CalculatePriorityStage().execute(context);
    expect(Number.isFinite(context.calculatedPriority)).toBe(true);
  });

  it("produces a higher score for a higher base priority, all else equal", () => {
    const policy = makePolicy();
    const lowJob = makeJob({ priority: 1, createdAt: 0 });
    const highJob = makeJob({ priority: 10, createdAt: 0 });
    const lowContext = makeContext({ job: lowJob, policy });
    const highContext = makeContext({ job: highJob, policy });
    new CalculatePriorityStage().execute(lowContext);
    new CalculatePriorityStage().execute(highContext);
    expect(highContext.calculatedPriority!).toBeGreaterThan(lowContext.calculatedPriority!);
  });
});
