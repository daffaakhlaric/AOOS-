import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEventType } from "../../src/events/knowledge-auto-update-event-type.js";
import { ExecuteUpdateStage } from "../../src/pipeline/stages/execute-update-stage.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";
import { makeContext, makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("ExecuteUpdateStage", () => {
  beforeEach(resetFixtureState);

  it("dispatches to the resolved strategy and produces a success result", () => {
    const job = makeJob({ updateType: KnowledgeUpdateType.Manual, payload: { a: 1 } });
    const context = makeContext({ job });
    const result = new ExecuteUpdateStage().execute(context);
    expect(result.result?.success).toBe(true);
    expect(result.result?.appliedPayload).toEqual({ a: 1 });
    expect(result.task).toBeDefined();
  });

  it("stores the task and result in the registry", () => {
    const job = makeJob();
    const context = makeContext({ job });
    const result = new ExecuteUpdateStage().execute(context);
    expect(context.registry.getTask(result.task!.id)).toBe(result.task);
    expect(context.registry.getResult(result.result!.id)).toBe(result.result);
  });

  it("records update started/succeeded statistics on success", () => {
    const context = makeContext();
    new ExecuteUpdateStage().execute(context);
    const snapshot = context.statistics.snapshot();
    expect(snapshot.updateCount).toBe(1);
    expect(snapshot.successCount).toBe(1);
  });

  it("publishes UpdateStarted and UpdateCompleted on success", () => {
    const publisher = new InMemoryEventPublisher();
    const context = makeContext({ services: makePipelineServices(undefined, publisher) });
    new ExecuteUpdateStage().execute(context);
    const types = publisher.getHistory().map((e) => e.eventType);
    expect(types).toContain(KnowledgeAutoUpdateEventType.UpdateStarted);
    expect(types).toContain(KnowledgeAutoUpdateEventType.UpdateCompleted);
  });

  it("publishes UpdateFailed and records failure statistics when the strategy fails", () => {
    const publisher = new InMemoryEventPublisher();
    const job = makeJob({ updateType: KnowledgeUpdateType.Version, payload: {} }); // missing version -> fails
    const context = makeContext({ job, services: makePipelineServices(undefined, publisher) });
    const result = new ExecuteUpdateStage().execute(context);
    expect(result.result?.success).toBe(false);
    expect(context.statistics.snapshot().failureCount).toBe(1);
    expect(
      publisher.getHistory().some((e) => e.eventType === KnowledgeAutoUpdateEventType.UpdateFailed),
    ).toBe(true);
  });

  it("uses the conflict resolution winner's payload when it differs from the job payload", () => {
    const job = makeJob({ payload: { a: 1 } });
    const context = makeContext({
      job,
      conflictCandidates: [
        { source: "other", payload: { a: 99 }, updatedAt: 100 },
        { source: job.id, payload: { a: 1 }, updatedAt: 0 },
      ],
    });
    context.conflictResolution = {
      winner: { source: "other", payload: { a: 99 }, updatedAt: 100 },
      strategy: context.policy.conflictResolution.strategy,
      reason: "latest_updated_at",
    };
    const result = new ExecuteUpdateStage().execute(context);
    expect(result.result?.appliedPayload).toEqual({ a: 99 });
  });
});
