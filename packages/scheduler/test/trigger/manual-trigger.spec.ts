import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { JobState } from "../../src/contracts/job-state.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { SchedulerException } from "../../src/errors/scheduler-exception.js";
import { StateTransitionException } from "../../src/errors/state-transition-exception.js";
import { InMemoryScheduleStore } from "../../src/store-interface/in-memory-schedule-store.js";
import { ManualTrigger } from "../../src/trigger/manual-trigger.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("Trigger Test — ManualTrigger", () => {
  it("fires a Waiting Manual job to Ready", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ state: JobState.WAITING }));
    const trigger = new ManualTrigger(store, new MockClock("2026-01-01T00:00:00.000Z"));

    const fired = await trigger.fire("job-1");
    expect(fired.state).toBe(JobState.READY);
    expect(fired.changelog).toEqual([JobState.PENDING, JobState.WAITING, JobState.READY]);
  });

  it("throws for an unknown jobId", async () => {
    const trigger = new ManualTrigger(new InMemoryScheduleStore(), new MockClock());
    await expect(trigger.fire("ghost")).rejects.toThrow(SchedulerException);
  });

  it("throws when the job's schedule is not Manual", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(
      jobFixture({ schedule: { type: ScheduleType.INTERVAL, timezone: "UTC", everyMs: 1000 } }),
    );
    const trigger = new ManualTrigger(store, new MockClock());
    await expect(trigger.fire("job-1")).rejects.toThrow(SchedulerException);
  });

  it("throws StateTransitionException when the job is not in a Ready-eligible state", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ state: JobState.COMPLETED }));
    const trigger = new ManualTrigger(store, new MockClock());
    await expect(trigger.fire("job-1")).rejects.toThrow(StateTransitionException);
  });
});
