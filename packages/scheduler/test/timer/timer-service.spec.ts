import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { JobState } from "../../src/contracts/job-state.js";
import { InMemoryScheduleStore } from "../../src/store-interface/in-memory-schedule-store.js";
import { TimerService } from "../../src/timer/timer-service.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("Timer Test — TimerService", () => {
  it("promotes every due Waiting job to Ready", async () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const store = new InMemoryScheduleStore();
    await store.create(
      jobFixture({
        jobId: "due-1",
        state: JobState.WAITING,
        nextFireAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    await store.create(
      jobFixture({
        jobId: "not-due",
        state: JobState.WAITING,
        nextFireAt: "2026-01-02T00:00:00.000Z",
      }),
    );

    const timer = new TimerService(clock, store);
    const result = await timer.tick();

    expect(result.readyJobIds).toEqual(["due-1"]);
    expect((await store.get("due-1"))?.state).toBe(JobState.READY);
    expect((await store.get("not-due"))?.state).toBe(JobState.WAITING);
  });

  it("appends Ready to the changelog", async () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const store = new InMemoryScheduleStore();
    await store.create(
      jobFixture({
        jobId: "due-1",
        state: JobState.WAITING,
        nextFireAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const timer = new TimerService(clock, store);
    await timer.tick();
    expect((await store.get("due-1"))?.changelog).toEqual([
      JobState.PENDING,
      JobState.WAITING,
      JobState.READY,
    ]);
  });

  it("returns an empty result when nothing is due", async () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const store = new InMemoryScheduleStore();
    const timer = new TimerService(clock, store);
    const result = await timer.tick();
    expect(result.readyJobIds).toEqual([]);
    expect(result.tickedAt).toEqual(clock.now());
  });

  it("reflects the clock's current time in tickedAt", async () => {
    const clock = new MockClock("2026-06-01T12:00:00.000Z");
    const store = new InMemoryScheduleStore();
    const timer = new TimerService(clock, store);
    const result = await timer.tick();
    expect(result.tickedAt.toISOString()).toBe("2026-06-01T12:00:00.000Z");
  });
});
