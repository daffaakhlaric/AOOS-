import { describe, expect, it, vi } from "vitest";

import { KnowledgeSynchronizationScheduleType } from "../../src/domain/knowledge-synchronization-schedule-type.js";
import { ScheduleNotFoundException } from "../../src/errors/schedule-not-found-exception.js";
import { KnowledgeSynchronizationScheduler } from "../../src/scheduler/knowledge-synchronization-scheduler.js";

describe("KnowledgeSynchronizationScheduler", () => {
  it("schedule() creates a pending entry", async () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    const entry = await scheduler.schedule({
      jobId: "job-1",
      scheduleType: KnowledgeSynchronizationScheduleType.CRON,
      cronExpression: "0 0 * * *",
    });
    expect(entry.status).toBe("pending");
    expect(entry.jobId).toBe("job-1");
  });

  it("trigger() marks an entry triggered", async () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    const entry = await scheduler.schedule({
      jobId: "job-1",
      scheduleType: KnowledgeSynchronizationScheduleType.ONE_TIME,
      runAt: "2026-01-01T00:00:00.000Z",
    });
    const triggered = scheduler.trigger(entry.id);
    expect(triggered.status).toBe("triggered");
    expect(triggered.triggeredAt).toBeDefined();
  });

  it("trigger() throws ScheduleNotFoundException for an unknown id", () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    expect(() => scheduler.trigger("missing")).toThrow(ScheduleNotFoundException);
  });

  it("cancel() marks an entry cancelled", async () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    const entry = await scheduler.schedule({
      jobId: "job-1",
      scheduleType: KnowledgeSynchronizationScheduleType.INTERVAL,
      intervalMs: 60000,
    });
    const cancelled = await scheduler.cancel(entry.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toBeDefined();
  });

  it("cancel() throws ScheduleNotFoundException for an unknown id", async () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    await expect(scheduler.cancel("missing")).rejects.toThrow(ScheduleNotFoundException);
  });

  it("get() returns undefined for an unknown id", () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    expect(scheduler.get("missing")).toBeUndefined();
  });

  it("require() throws for an unknown id", () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    expect(() => scheduler.require("missing")).toThrow(ScheduleNotFoundException);
  });

  it("list() returns every entry, optionally filtered by jobId", async () => {
    const scheduler = new KnowledgeSynchronizationScheduler();
    await scheduler.schedule({
      jobId: "job-a",
      scheduleType: KnowledgeSynchronizationScheduleType.MANUAL_TRIGGER,
    });
    await scheduler.schedule({
      jobId: "job-b",
      scheduleType: KnowledgeSynchronizationScheduleType.MANUAL_TRIGGER,
    });
    expect(scheduler.list()).toHaveLength(2);
    expect(scheduler.list("job-a")).toHaveLength(1);
  });

  it("delegates schedule()/cancel() to an external scheduler when configured", async () => {
    const externalSchedule = vi.fn();
    const externalCancel = vi.fn();
    const scheduler = new KnowledgeSynchronizationScheduler({
      schedule: externalSchedule,
      cancel: externalCancel,
    });
    const entry = await scheduler.schedule({
      jobId: "job-1",
      scheduleType: KnowledgeSynchronizationScheduleType.EVENT_TRIGGER,
    });
    expect(externalSchedule).toHaveBeenCalledWith(entry);
    await scheduler.cancel(entry.id);
    expect(externalCancel).toHaveBeenCalledWith(entry.id);
  });
});
