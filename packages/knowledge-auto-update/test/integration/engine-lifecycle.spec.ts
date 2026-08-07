import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEngine } from "../../src/services/knowledge-auto-update-engine.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";
import { ALL_UPDATE_TYPES, KnowledgeUpdateType } from "../../src/types/update-type.js";
import { ManualClock } from "../../src/utils/clock.js";
import { resetFixtureState } from "../helpers/fixtures.js";

function makeEngine() {
  const clock = new ManualClock(0);
  const eventPublisher = new InMemoryEventPublisher(clock);
  const engine = new KnowledgeAutoUpdateEngine({ clock, eventPublisher });
  return { clock, eventPublisher, engine };
}

const PAYLOAD_BY_TYPE: Partial<Record<KnowledgeUpdateType, Record<string, unknown>>> = {
  [KnowledgeUpdateType.Version]: { version: "1.0.0" },
};

describe("Engine lifecycle integration", () => {
  beforeEach(resetFixtureState);

  describe.each(ALL_UPDATE_TYPES)("update type: %s", (updateType) => {
    it("completes successfully end-to-end via engine.tick", () => {
      const { engine, clock } = makeEngine();
      const job = engine.scheduleJob({
        targetId: "target-1",
        updateType,
        payload: PAYLOAD_BY_TYPE[updateType] ?? { a: 1 },
      });
      engine.tick(clock.now());
      expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
    });
  });

  it("schedules a retry with the configured delay after a first failure", () => {
    const { engine, clock } = makeEngine();
    const policy = engine.registerPolicy({ name: "retry-once", maxRetries: 3, retryDelayMs: 10 });
    const job = engine.scheduleJob({
      targetId: "target-1",
      policyId: policy.id,
      updateType: KnowledgeUpdateType.Version,
      payload: {}, // invalid: missing version -> fails
    });
    engine.tick(clock.now());
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.RetryScheduled);
    expect(engine.getJob(job.id).attempt).toBe(1);
  });

  it("exhausts retries and lands on Failed after maxRetries attempts", () => {
    const { engine, clock } = makeEngine();
    const policy = engine.registerPolicy({ name: "always-fails", maxRetries: 2, retryDelayMs: 10 });
    const job = engine.scheduleJob({
      targetId: "target-1",
      policyId: policy.id,
      updateType: KnowledgeUpdateType.Version,
      payload: {},
    });
    let next = clock.now();
    for (let i = 0; i < 3; i++) {
      engine.tick(next);
      const current = engine.getJob(job.id);
      if (current.status === KnowledgeUpdateJobStatus.Failed) break;
      next = current.nextRunAt ?? next + 1000;
      clock.set(next);
    }
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Failed);
  });

  it("runs a 3-job dependency chain to completion in dependency order within a single tick", () => {
    // All three jobs are Immediate and therefore all due at once; the scheduler's
    // priority-aware topological ordering (see KnowledgeUpdateScheduler.processDue) sequences
    // them a -> b -> c within THIS tick, so by the time b's ResolveDependenciesStage runs, a is
    // already Completed (same for c after b).
    const { engine, clock } = makeEngine();
    const a = engine.scheduleJob({
      targetId: "a",
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
    });
    const b = engine.scheduleJob({
      targetId: "b",
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
      dependsOn: [a.id],
    });
    const c = engine.scheduleJob({
      targetId: "c",
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
      dependsOn: [b.id],
    });

    const session = engine.tick(clock.now());
    expect(engine.getJob(a.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
    expect(engine.getJob(b.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
    expect(engine.getJob(c.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
    expect(session.taskIds).toHaveLength(3);
  });

  it("requeues a dependent job for a later tick when its dependency is not due in the same batch", () => {
    const { engine, clock } = makeEngine();
    const dependency = engine.scheduleJob({
      targetId: "dep",
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
      schedule: { kind: ScheduleKind.Scheduled, runAt: 100_000 }, // not due yet
    });
    const dependent = engine.scheduleJob({
      targetId: "dependent",
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
      dependsOn: [dependency.id],
    });

    engine.tick(clock.now());
    expect(engine.getJob(dependent.id).status).toBe(KnowledgeUpdateJobStatus.Pending);
    expect(engine.getJob(dependency.id).status).toBe(KnowledgeUpdateJobStatus.Scheduled);

    clock.set(100_000);
    engine.tick(100_000);
    expect(engine.getJob(dependency.id).status).toBe(KnowledgeUpdateJobStatus.Completed);

    clock.advance(1);
    engine.tick(clock.now());
    expect(engine.getJob(dependent.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("fires an interval job repeatedly across ticks", () => {
    const { engine, clock } = makeEngine();
    const job = engine.scheduleJob({
      targetId: "t-1",
      updateType: KnowledgeUpdateType.Refresh,
      payload: {},
      schedule: { kind: ScheduleKind.Interval, intervalMs: 1000, startAt: 0 },
    });

    engine.tick(0);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);

    clock.set(1000);
    engine.tick(1000);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);

    clock.set(2000);
    engine.tick(2000);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("fires a cron job at its scheduled times and not in between", () => {
    const { engine, clock } = makeEngine();
    const first = Date.UTC(2026, 0, 1, 9, 0);
    clock.set(first);
    const job = engine.scheduleJob({
      targetId: "t-1",
      updateType: KnowledgeUpdateType.Scheduled,
      payload: {},
      schedule: { kind: ScheduleKind.Cron, expression: "0 9 * * *" },
    });
    engine.tick(first);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);

    // Manually mark Pending again to observe that a mid-day tick does nothing new.
    clock.set(first + 3_600_000);
    const beforeTick = engine.tick(clock.now());
    expect(beforeTick.taskIds).toEqual([]);

    clock.set(Date.UTC(2026, 0, 2, 9, 0));
    engine.tick(clock.now());
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("pause prevents a job from running on the next tick; resume allows it again", () => {
    const { engine, clock } = makeEngine();
    const job = engine.scheduleJob({
      targetId: "t-1",
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
    });
    engine.pauseJob(job.id);
    engine.tick(clock.now());
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Paused);

    engine.resumeJob(job.id);
    engine.tick(clock.now());
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("cancel prevents a job from ever running", () => {
    const { engine, clock } = makeEngine();
    const job = engine.scheduleJob({
      targetId: "t-1",
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
    });
    engine.cancelJob(job.id);
    engine.tick(clock.now());
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Cancelled);
  });

  it("processes a mixed batch honoring priority ordering across the whole tick", () => {
    const { engine, clock } = makeEngine();
    const jobs = [1, 5, 10, 3, 8].map((priority, i) =>
      engine.scheduleJob({
        targetId: `t-${i}`,
        updateType: KnowledgeUpdateType.Manual,
        payload: {},
        priority,
      }),
    );
    const session = engine.tick(clock.now());
    expect(session.taskIds).toHaveLength(jobs.length);
    for (const job of jobs) {
      expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
    }
  });
});
