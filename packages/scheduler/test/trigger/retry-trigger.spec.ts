import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { JobState } from "../../src/contracts/job-state.js";
import { RetryStrategy } from "../../src/contracts/retry-policy.js";
import { RetryExhaustedException } from "../../src/errors/retry-exhausted-exception.js";
import { SchedulerException } from "../../src/errors/scheduler-exception.js";
import { LinearBackoffPolicy } from "../../src/retry/linear-backoff-policy.js";
import { InMemoryScheduleStore } from "../../src/store-interface/in-memory-schedule-store.js";
import { RetryTrigger } from "../../src/trigger/retry-trigger.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("Retry Test — RetryTrigger", () => {
  it("schedules the first retry with attempt 1 and a computed nextRetryAt", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ state: JobState.FAILED }));
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const trigger = new RetryTrigger(store, clock);

    const retried = await trigger.scheduleRetry("job-1", new LinearBackoffPolicy(3, 1000), "boom");

    expect(retried.state).toBe(JobState.RETRYING);
    expect(retried.retryMetadata).toEqual({
      attempt: 1,
      maxAttempts: 3,
      lastError: "boom",
      nextRetryAt: "2026-01-01T00:00:01.000Z",
    });
    expect(retried.nextFireAt).toBe("2026-01-01T00:00:01.000Z");
  });

  it("increments the attempt count on subsequent retries", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(
      jobFixture({
        state: JobState.FAILED,
        retryMetadata: { attempt: 1, maxAttempts: 3, lastError: "first" },
      }),
    );
    const trigger = new RetryTrigger(store, new MockClock("2026-01-01T00:00:00.000Z"));
    const retried = await trigger.scheduleRetry(
      "job-1",
      new LinearBackoffPolicy(3, 1000),
      "second",
    );
    expect(retried.retryMetadata?.attempt).toBe(2);
  });

  it("throws RetryExhaustedException once maxAttempts is exceeded", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(
      jobFixture({
        state: JobState.FAILED,
        retryMetadata: { attempt: 2, maxAttempts: 2, lastError: "second" },
      }),
    );
    const trigger = new RetryTrigger(store, new MockClock("2026-01-01T00:00:00.000Z"));
    await expect(
      trigger.scheduleRetry("job-1", new LinearBackoffPolicy(2, 1000), "third"),
    ).rejects.toThrow(RetryExhaustedException);
  });

  it("throws SchedulerException for an unknown jobId", async () => {
    const trigger = new RetryTrigger(new InMemoryScheduleStore(), new MockClock());
    await expect(
      trigger.scheduleRetry("ghost", new LinearBackoffPolicy(3, 1000), "boom"),
    ).rejects.toThrow(SchedulerException);
  });

  it("respects the given policy's strategy for delay computation", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ state: JobState.FAILED }));
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const trigger = new RetryTrigger(store, clock);
    const retried = await trigger.scheduleRetry(
      "job-1",
      { strategy: RetryStrategy.EXPONENTIAL, maxAttempts: 5, nextDelayMs: () => 5000 },
      "boom",
    );
    expect(retried.nextFireAt).toBe("2026-01-01T00:00:05.000Z");
  });
});
