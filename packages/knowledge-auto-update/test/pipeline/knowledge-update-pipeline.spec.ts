import { beforeEach, describe, expect, it } from "vitest";

import { PipelineStageFailureException } from "../../src/errors/pipeline-stage-failure-exception.js";
import { KnowledgeUpdatePipeline } from "../../src/pipeline/knowledge-update-pipeline.js";
import type { PipelineStage } from "../../src/pipeline/pipeline-stage.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeJob, makePolicy, resetFixtureState } from "../helpers/fixtures.js";
import { makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("KnowledgeUpdatePipeline", () => {
  beforeEach(resetFixtureState);

  it("runs all 10 stages end-to-end for a successful manual update", () => {
    const services = makePipelineServices();
    const job = makeJob({ updateType: KnowledgeUpdateType.Manual, payload: { a: 1 } });
    const policy = makePolicy();
    services.registry.putJob(job);
    services.registry.putPolicy(policy);

    const pipeline = new KnowledgeUpdatePipeline();
    const context = pipeline.run({ job, policy, sessionId: "s-1", dependentCount: 0 }, services);

    expect(context.detection).toBeDefined();
    expect(context.changeMagnitude).toBeDefined();
    expect(context.conflictResolution).toBeDefined();
    expect(context.calculatedPriority).toBeDefined();
    expect(context.task).toBeDefined();
    expect(context.result?.success).toBe(true);
    expect(context.report).toBeDefined();
  });

  it("runs successfully for every one of the 13 update types with a compatible payload", () => {
    const perTypePayload: Partial<Record<KnowledgeUpdateType, Record<string, unknown>>> = {
      [KnowledgeUpdateType.Version]: { version: "1.0.0" },
    };
    for (const updateType of Object.values(KnowledgeUpdateType)) {
      const services = makePipelineServices();
      const job = makeJob({ updateType, payload: perTypePayload[updateType] ?? { a: 1 } });
      const policy = makePolicy();
      services.registry.putJob(job);
      services.registry.putPolicy(policy);
      const context = new KnowledgeUpdatePipeline().run(
        { job, policy, sessionId: "s-1", dependentCount: 0 },
        services,
      );
      expect(context.result?.success).toBe(true);
    }
  });

  it("wraps a stage failure in PipelineStageFailureException naming the failing stage", () => {
    const services = makePipelineServices();
    const job = makeJob({ targetId: "" }); // invalid -> ValidateUpdateStage throws
    const policy = makePolicy();
    services.registry.putJob(job);
    services.registry.putPolicy(policy);

    const pipeline = new KnowledgeUpdatePipeline();
    try {
      pipeline.run({ job, policy, sessionId: "s-1", dependentCount: 0 }, services);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineStageFailureException);
      expect((error as PipelineStageFailureException).context?.stageName).toBe("validate-update");
    }
  });

  it("stops before executing later stages when an earlier stage throws", () => {
    const services = makePipelineServices();
    const job = makeJob({ dependsOn: ["unregistered-dependency"] });
    const policy = makePolicy();
    services.registry.putJob(job);
    services.registry.putPolicy(policy);

    const pipeline = new KnowledgeUpdatePipeline();
    expect(() =>
      pipeline.run({ job, policy, sessionId: "s-1", dependentCount: 0 }, services),
    ).toThrow(PipelineStageFailureException);
    // Execute Update never ran, so no task/result should have been recorded.
    expect(services.registry.listTasks()).toHaveLength(0);
  });

  it("accepts a custom stage list (extensibility)", () => {
    const noOpStage: PipelineStage = {
      name: "no-op",
      execute: (context) => context,
    };
    const pipeline = new KnowledgeUpdatePipeline([noOpStage]);
    const services = makePipelineServices();
    const job = makeJob();
    const policy = makePolicy();
    services.registry.putJob(job);
    services.registry.putPolicy(policy);
    const context = pipeline.run({ job, policy, sessionId: "s-1", dependentCount: 0 }, services);
    expect(context.task).toBeUndefined();
  });

  it("assigns a fresh runId per run", () => {
    const services = makePipelineServices();
    const job = makeJob();
    const policy = makePolicy();
    services.registry.putJob(job);
    services.registry.putPolicy(policy);
    const pipeline = new KnowledgeUpdatePipeline();
    const a = pipeline.run({ job, policy, sessionId: "s-1", dependentCount: 0 }, services);
    const b = pipeline.run({ job, policy, sessionId: "s-1", dependentCount: 0 }, services);
    expect(a.runId).not.toBe(b.runId);
  });

  it("leaves the job status untouched (coordinator's responsibility, not the pipeline's)", () => {
    const services = makePipelineServices();
    const job = makeJob({ status: KnowledgeUpdateJobStatus.Running });
    const policy = makePolicy();
    services.registry.putJob(job);
    services.registry.putPolicy(policy);
    const pipeline = new KnowledgeUpdatePipeline();
    const context = pipeline.run({ job, policy, sessionId: "s-1", dependentCount: 0 }, services);
    expect(context.job.status).toBe(KnowledgeUpdateJobStatus.Running);
  });
});
