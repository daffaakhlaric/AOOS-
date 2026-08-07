import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdateJob } from "../../src/entities/knowledge-update-job.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEventType } from "../../src/events/knowledge-auto-update-event-type.js";
import { KnowledgeUpdatePolicyFactory } from "../../src/factories/knowledge-update-policy-factory.js";
import { KnowledgeUpdatePipeline } from "../../src/pipeline/knowledge-update-pipeline.js";
import { KnowledgeUpdateRegistry } from "../../src/registry/knowledge-update-registry.js";
import { KnowledgeUpdateScheduler } from "../../src/scheduler/knowledge-update-scheduler.js";
import { KnowledgeUpdateCoordinator } from "../../src/services/knowledge-update-coordinator.js";
import { KnowledgeUpdateManager } from "../../src/services/knowledge-update-manager.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { ManualClock } from "../../src/utils/clock.js";
import { resetFixtureState } from "../helpers/fixtures.js";
import { makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("KnowledgeUpdateCoordinator", () => {
  beforeEach(resetFixtureState);

  function setup(retryOverrides: Partial<{ maxRetries: number; retryDelayMs: number }> = {}) {
    const registry = new KnowledgeUpdateRegistry();
    const clock = new ManualClock(0);
    const publisher = new InMemoryEventPublisher(clock);
    const scheduler = new KnowledgeUpdateScheduler();
    const manager = new KnowledgeUpdateManager(registry, clock);
    const services = makePipelineServices(clock, publisher);
    const realServices = { ...services, registry };
    const policy = new KnowledgeUpdatePolicyFactory().create({
      name: "coord-policy",
      maxRetries: retryOverrides.maxRetries ?? 2,
      retryDelayMs: retryOverrides.retryDelayMs ?? 100,
    });
    registry.putPolicy(policy);
    const coordinator = new KnowledgeUpdateCoordinator(
      registry,
      scheduler,
      manager,
      new KnowledgeUpdatePipeline(),
      realServices,
    );
    return { registry, clock, scheduler, manager, coordinator, policy, publisher };
  }

  it("completes a successful immediate job in one tick", () => {
    const { manager, scheduler, coordinator, policy, registry } = setup();
    const job = manager.createJob({
      targetId: "t-1",
      policyId: policy.id,
      updateType: KnowledgeUpdateType.Manual,
      payload: { a: 1 },
    });
    scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, 0);

    const session = coordinator.processTick(0);
    expect(manager.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
    expect(session.taskIds).toHaveLength(1);
    expect(session.resultIds).toHaveLength(1);
    expect(registry.getSession(session.id).completedAt).toBe(0);
  });

  it("schedules a retry with backoff on failure and eventually fails after exhausting retries", () => {
    const { manager, scheduler, coordinator, policy, clock, publisher } = setup({
      maxRetries: 2,
      retryDelayMs: 100,
    });
    const job = manager.createJob({
      targetId: "t-1",
      policyId: policy.id,
      updateType: KnowledgeUpdateType.Version,
      payload: {}, // missing version -> always fails
    });
    scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, 0);

    coordinator.processTick(0);
    let current = manager.getJob(job.id);
    expect(current.status).toBe(KnowledgeUpdateJobStatus.RetryScheduled);
    expect(current.attempt).toBe(1);
    expect(scheduler.getNextRunAt(job.id)).toBe(100);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.UpdateRetried),
    ).toBe(true);

    clock.set(100);
    coordinator.processTick(100);
    current = manager.getJob(job.id);
    expect(current.status).toBe(KnowledgeUpdateJobStatus.RetryScheduled);
    expect(current.attempt).toBe(2);
    // Backoff doubled: retryDelayMs * multiplier^1 = 100 * 2 = 200
    expect(scheduler.getNextRunAt(job.id)).toBe(300);

    clock.set(300);
    coordinator.processTick(300);
    current = manager.getJob(job.id);
    expect(current.status).toBe(KnowledgeUpdateJobStatus.Failed);
    expect(scheduler.isScheduled(job.id)).toBe(false);
  });

  it("requeues a job blocked on an unfinished dependency without counting it as a failure", () => {
    const { manager, scheduler, coordinator, policy } = setup();
    const dependency = manager.createJob({ targetId: "t-1", policyId: policy.id });
    scheduler.register(
      dependency.id,
      dependency.schedule,
      dependency.priority,
      dependency.dependsOn,
      0,
    );
    const dependent = manager.createJob({
      targetId: "t-2",
      policyId: policy.id,
      dependsOn: [dependency.id],
    });
    scheduler.register(
      dependent.id,
      dependent.schedule,
      dependent.priority,
      dependent.dependsOn,
      0,
    );

    // Only make the dependent due, leaving dependency Pending (unfinished).
    scheduler.cancel(dependency.id);
    coordinator.processTick(0);

    const updated = manager.getJob(dependent.id);
    expect(updated.status).toBe(KnowledgeUpdateJobStatus.Pending);
    expect(updated.attempt).toBe(0);
    expect(scheduler.isScheduled(dependent.id)).toBe(true);
  });

  it("pauseJob pauses the scheduler entry and updates job status", () => {
    const { manager, scheduler, coordinator, policy, publisher } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: policy.id });
    scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, 0);
    coordinator.pauseJob(job.id);
    expect(scheduler.isPaused(job.id)).toBe(true);
    expect(manager.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Paused);
    expect(
      publisher.getHistory().some((e) => e.eventType === KnowledgeAutoUpdateEventType.UpdatePaused),
    ).toBe(true);
  });

  it("resumeJob resumes the scheduler entry and updates job status", () => {
    const { manager, scheduler, coordinator, policy, publisher } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: policy.id });
    scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, 0);
    coordinator.pauseJob(job.id);
    coordinator.resumeJob(job.id);
    expect(scheduler.isPaused(job.id)).toBe(false);
    expect(manager.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Scheduled);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.UpdateResumed),
    ).toBe(true);
  });

  it("cancelJob removes the scheduler entry and marks the job Cancelled", () => {
    const { manager, scheduler, coordinator, policy, publisher } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: policy.id });
    scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, 0);
    coordinator.cancelJob(job.id);
    expect(scheduler.isScheduled(job.id)).toBe(false);
    expect(manager.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Cancelled);
    expect(
      publisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.UpdateCancelled),
    ).toBe(true);
  });

  it("cancelJob is safe to call on a job already removed from the scheduler", () => {
    const { manager, coordinator, policy } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: policy.id });
    expect(() => coordinator.cancelJob(job.id)).not.toThrow();
    expect(manager.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Cancelled);
  });

  it("processTick with no due jobs returns a completed session with no tasks", () => {
    const { coordinator } = setup();
    const session = coordinator.processTick(0);
    expect(session.taskIds).toEqual([]);
    expect(session.completedAt).toBe(0);
  });

  it("counts a Scheduled dependent (not just Pending) toward dependent count via priority calc", () => {
    const { manager, scheduler, coordinator, policy } = setup();
    const dependency = manager.createJob({ targetId: "t-dep", policyId: policy.id });
    const dependent = manager.createJob({
      targetId: "t-dependent",
      policyId: policy.id,
      dependsOn: [dependency.id],
    });
    manager.transitionStatus(dependent.id, KnowledgeUpdateJobStatus.Scheduled);
    scheduler.register(
      dependency.id,
      dependency.schedule,
      dependency.priority,
      dependency.dependsOn,
      0,
    );
    // dependency runs; dependent (Scheduled, not due) is counted as a dependent via countDependents.
    const session = coordinator.processTick(0);
    expect(session.taskIds).toHaveLength(1);
    expect(manager.getJob(dependency.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("routes a non-dependency pipeline failure (e.g. structurally invalid job) through handleFailure", () => {
    const { manager, scheduler, coordinator, policy, registry } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: policy.id });
    // Corrupt the stored job to be structurally invalid so ValidateUpdateStage throws
    // ValidationFailedException (not DependencyNotSatisfiedException).
    registry.putJob(new KnowledgeUpdateJob({ ...job, targetId: "" }));
    scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, 0);
    coordinator.processTick(0);
    expect(manager.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.RetryScheduled);
  });

  it("requeueBlockedJob reschedules in place when the scheduler entry still exists", () => {
    const { manager, scheduler, coordinator, policy } = setup();
    const dependency = manager.createJob({ targetId: "t-dep", policyId: policy.id });
    const dependent = manager.createJob({
      targetId: "t-dependent",
      policyId: policy.id,
      dependsOn: [dependency.id],
    });
    // Interval schedule: scheduler re-adds the entry to itself before the pipeline runs,
    // so when ResolveDependenciesStage throws, isScheduled(dependent.id) is already true.
    scheduler.register(
      dependent.id,
      { kind: ScheduleKind.Interval, intervalMs: 1000, startAt: 0 },
      0,
      [dependency.id],
      0,
    );
    coordinator.processTick(0);
    expect(manager.getJob(dependent.id).status).toBe(KnowledgeUpdateJobStatus.Pending);
    expect(scheduler.isScheduled(dependent.id)).toBe(true);
  });

  it("processTick is idempotent when called twice with no new due jobs", () => {
    const { coordinator, clock } = setup();
    const first = coordinator.processTick(clock.now());
    const second = coordinator.processTick(clock.now());
    expect(first.taskIds).toEqual([]);
    expect(second.taskIds).toEqual([]);
    expect(first.id).not.toBe(second.id);
  });

  it("each processTick call creates a new, distinct session", () => {
    const { manager, scheduler, coordinator, policy } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: policy.id });
    scheduler.register(job.id, job.schedule, job.priority, job.dependsOn, 0);
    const session = coordinator.processTick(0);
    expect(session.id).toBeDefined();
    expect(session.startedAt).toBe(0);
    expect(session.completedAt).toBe(0);
  });

  it("processes multiple due jobs in one tick in priority order", () => {
    const { manager, scheduler, coordinator, policy } = setup();
    const low = manager.createJob({ targetId: "t-low", policyId: policy.id, priority: 1 });
    const high = manager.createJob({ targetId: "t-high", policyId: policy.id, priority: 10 });
    scheduler.register(low.id, low.schedule, low.priority, low.dependsOn, 0);
    scheduler.register(high.id, high.schedule, high.priority, high.dependsOn, 0);
    const session = coordinator.processTick(0);
    expect(session.taskIds).toHaveLength(2);
  });
});
