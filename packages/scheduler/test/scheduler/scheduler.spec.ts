import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { JobPriority } from "../../src/contracts/job-priority.js";
import { JobState } from "../../src/contracts/job-state.js";
import { RetryStrategy } from "../../src/contracts/retry-policy.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { SchedulerException } from "../../src/errors/scheduler-exception.js";
import { StateTransitionException } from "../../src/errors/state-transition-exception.js";
import { ValidationException } from "../../src/errors/validation-exception.js";
import { SchedulerEventPublisher } from "../../src/events/scheduler-event-publisher.js";
import { SchedulerJobEventType } from "../../src/events/scheduler-job-event-type.js";
import { Scheduler } from "../../src/scheduler/scheduler.js";

function fakePublisher(): { publisher: IPublisher; publish: ReturnType<typeof vi.fn> } {
  const publish = vi.fn(async (input: PublishInput): Promise<BaseEventShape> => ({
    eventId: "e-1",
    type: input.type,
    category: input.category,
    correlationId: "corr-1",
    source: input.source,
    producer: input.producer,
    timestamp: "2026-01-01T00:00:00.000Z",
    priority: input.priority as never,
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload: input.payload,
    tenantId: input.tenantId,
  }));
  return { publisher: { publish, publishAsync: publish, publishBatch: vi.fn() }, publish };
}

function newScheduler(clock = new MockClock("2026-01-01T00:00:00.000Z")) {
  const { publisher, publish } = fakePublisher();
  const scheduler = new Scheduler({
    eventPublisher: new SchedulerEventPublisher(publisher),
    clock,
  });
  return { scheduler, publish, clock };
}

function eventTypes(publish: ReturnType<typeof vi.fn>): string[] {
  return publish.mock.calls.map((call) => (call[0] as PublishInput).type);
}

describe("Job Lifecycle — Scheduler.createJob", () => {
  it("creates a Job in Waiting state with a computed nextFireAt, and publishes CREATED", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await scheduler.createJob({
      name: "daily-report",
      schedule: { type: ScheduleType.CRON, timezone: "UTC", expression: "0 9 * * *" },
    });

    expect(job.state).toBe(JobState.WAITING);
    expect(job.nextFireAt).toBe("2026-01-01T09:00:00.000Z");
    expect(job.priority).toBe(JobPriority.NORMAL);
    expect(job.changelog).toEqual([JobState.PENDING, JobState.WAITING]);
    expect(eventTypes(publish)).toEqual([SchedulerJobEventType.CREATED]);
    expect(scheduler.metrics.snapshot().jobsCreated).toBe(1);
  });

  it("rejects an invalid job with ValidationException, without creating it", async () => {
    const { scheduler } = newScheduler();
    await expect(
      scheduler.createJob({
        name: "bad",
        schedule: { type: ScheduleType.CRON, timezone: "UTC", expression: "not a cron" },
      }),
    ).rejects.toThrow(ValidationException);
    expect((await scheduler.scheduleStore.list()).length).toBe(0);
  });

  it("Dependency Test: rejects a job depending on an unknown id", async () => {
    const { scheduler } = newScheduler();
    await expect(
      scheduler.createJob({
        name: "downstream",
        schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["ghost"] },
      }),
    ).rejects.toThrow(ValidationException);
  });

  it("Dependency Test: accepts a job depending on an existing job", async () => {
    const { scheduler } = newScheduler();
    const upstream = await scheduler.createJob({
      name: "upstream",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    const downstream = await scheduler.createJob({
      name: "downstream",
      schedule: {
        type: ScheduleType.DEPENDENCY,
        timezone: "UTC",
        dependsOnJobIds: [upstream.jobId],
      },
    });
    expect(downstream.state).toBe(JobState.WAITING);
  });

  it("a Manual/Dependency job has no computed nextFireAt", async () => {
    const { scheduler } = newScheduler();
    const job = await scheduler.createJob({
      name: "manual-job",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    expect(job.nextFireAt).toBeUndefined();
  });
});

describe("Job Lifecycle — pause/resume/cancel/delete", () => {
  it("pauseJob transitions Waiting → Paused and publishes PAUSED", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    const paused = await scheduler.pauseJob(job.jobId);
    expect(paused.state).toBe(JobState.PAUSED);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.PAUSED);
  });

  it("resumeJob transitions Paused → Waiting and publishes RESUMED", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    await scheduler.pauseJob(job.jobId);
    const resumed = await scheduler.resumeJob(job.jobId);
    expect(resumed.state).toBe(JobState.WAITING);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.RESUMED);
  });

  it("cancelJob transitions to Cancelled and publishes CANCELLED", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    const cancelled = await scheduler.cancelJob(job.jobId);
    expect(cancelled.state).toBe(JobState.CANCELLED);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.CANCELLED);
  });

  it("rejects an invalid transition with StateTransitionException", async () => {
    const { scheduler } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    await scheduler.cancelJob(job.jobId);
    await expect(scheduler.resumeJob(job.jobId)).rejects.toThrow(StateTransitionException);
  });

  it("deleteJob removes the job and publishes DELETED", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    await scheduler.deleteJob(job.jobId);
    expect(await scheduler.scheduleStore.get(job.jobId)).toBeUndefined();
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.DELETED);
  });

  it("deleteJob throws for an unknown jobId", async () => {
    const { scheduler } = newScheduler();
    await expect(scheduler.deleteJob("ghost")).rejects.toThrow(SchedulerException);
  });
});

describe("Trigger Flow — Scheduler.fireManual", () => {
  it("fires a Manual job to Ready and publishes READY", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    const fired = await scheduler.fireManual(job.jobId);
    expect(fired.state).toBe(JobState.READY);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.READY);
  });
});

describe("Trigger Flow — Scheduler.tick", () => {
  it("promotes due jobs to Ready and publishes READY for each", async () => {
    const { scheduler, publish, clock } = newScheduler(new MockClock("2026-01-01T08:00:00.000Z"));
    await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.CRON, timezone: "UTC", expression: "0 9 * * *" },
    });
    clock.set("2026-01-01T09:00:01.000Z");

    const readyJobIds = await scheduler.tick();
    expect(readyJobIds).toHaveLength(1);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.READY);
    expect(scheduler.metrics.snapshot().avgSchedulerLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("does nothing when nothing is due", async () => {
    const { scheduler, publish } = newScheduler();
    await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.CRON, timezone: "UTC", expression: "0 9 * * *" },
    });
    const readyJobIds = await scheduler.tick();
    expect(readyJobIds).toEqual([]);
    expect(publish).toHaveBeenCalledTimes(1); // only CREATED
  });
});

describe("Event Publishing Flow — reportStarted/Completed/Failed", () => {
  async function createReadyJob(scheduler: Scheduler) {
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    return scheduler.fireManual(job.jobId);
  }

  it("reportStarted transitions Ready → Running, records Execution Delay, and publishes STARTED", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await createReadyJob(scheduler);
    const started = await scheduler.reportStarted(job.jobId);
    expect(started.state).toBe(JobState.RUNNING);
    expect(scheduler.metrics.snapshot().jobsRunning).toBe(1);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.STARTED);
  });

  it("reportCompleted transitions Running → Completed, publishes COMPLETED, and readies dependents", async () => {
    const { scheduler, publish } = newScheduler();
    const upstream = await createReadyJob(scheduler);
    await scheduler.reportStarted(upstream.jobId);

    const downstream = await scheduler.createJob({
      name: "downstream",
      schedule: {
        type: ScheduleType.DEPENDENCY,
        timezone: "UTC",
        dependsOnJobIds: [upstream.jobId],
      },
    });

    await scheduler.reportCompleted(upstream.jobId);

    expect((await scheduler.scheduleStore.get(upstream.jobId))?.state).toBe(JobState.COMPLETED);
    expect((await scheduler.scheduleStore.get(downstream.jobId))?.state).toBe(JobState.READY);
    expect(scheduler.metrics.snapshot().jobsSucceeded).toBe(1);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.COMPLETED);
    expect(eventTypes(publish).filter((t) => t === SchedulerJobEventType.READY)).toHaveLength(2); // manual fire + dependent readied
  });

  it("reportFailed without a retry policy expires the job immediately", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await createReadyJob(scheduler);
    await scheduler.reportStarted(job.jobId);

    const result = await scheduler.reportFailed(job.jobId, "boom");
    expect(result.state).toBe(JobState.EXPIRED);
    expect(scheduler.metrics.snapshot().jobsFailed).toBe(1);
    expect(eventTypes(publish)).toEqual(
      expect.arrayContaining([SchedulerJobEventType.FAILED, SchedulerJobEventType.EXPIRED]),
    );
  });

  it("reportFailed with a retry policy schedules a retry and publishes RETRY", async () => {
    const { scheduler, publish } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
      retryPolicyConfig: {
        strategy: RetryStrategy.LINEAR,
        maxAttempts: 2,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
      },
    });
    await scheduler.fireManual(job.jobId);
    await scheduler.reportStarted(job.jobId);

    const retried = await scheduler.reportFailed(job.jobId, "transient error");
    expect(retried.state).toBe(JobState.RETRYING);
    expect(scheduler.metrics.snapshot().retryCount).toBe(1);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.RETRY);
  });

  it("reportFailed expires the job once retries are exhausted", async () => {
    const { scheduler, publish, clock } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
      retryPolicyConfig: {
        strategy: RetryStrategy.LINEAR,
        maxAttempts: 1,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
      },
    });
    await scheduler.fireManual(job.jobId);
    await scheduler.reportStarted(job.jobId);

    // First failure: attempt 1 of 1 — schedules one retry, does not exhaust yet.
    const retried = await scheduler.reportFailed(job.jobId, "first failure");
    expect(retried.state).toBe(JobState.RETRYING);

    // Let the retry delay elapse and the Timer promote it back to Ready, then fail again —
    // this is the attempt that exceeds maxAttempts and exhausts the Retry Policy.
    clock.advanceMs(1001);
    await scheduler.tick();
    await scheduler.reportStarted(job.jobId);
    const result = await scheduler.reportFailed(job.jobId, "final failure");

    expect(result.state).toBe(JobState.EXPIRED);
    expect(eventTypes(publish)).toContain(SchedulerJobEventType.EXPIRED);
  });
});

describe("Queue Flow — Scheduler.dispatchReady", () => {
  it("dispatches a Ready job through the Policy Pipeline + Distributed Lock", async () => {
    const { scheduler } = newScheduler();
    const job = await scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    await scheduler.fireManual(job.jobId);
    const decision = await scheduler.dispatchReady(job.jobId);
    expect(decision.dispatched).toBe(true);
  });
});
