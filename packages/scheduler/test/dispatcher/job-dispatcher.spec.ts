import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { JobPriority } from "../../src/contracts/job-priority.js";
import { JobDispatcher } from "../../src/dispatcher/job-dispatcher.js";
import { SchedulerException } from "../../src/errors/scheduler-exception.js";
import { InMemoryLockProvider } from "../../src/lock/in-memory-lock-provider.js";
import { PolicyPipeline } from "../../src/policy/policy-pipeline.js";
import { InMemoryScheduleStore } from "../../src/store-interface/in-memory-schedule-store.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("Queue Flow — JobDispatcher", () => {
  it("dispatches when policies allow and the lock is free", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture());
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const dispatcher = new JobDispatcher({
      store,
      policyPipeline: new PolicyPipeline(),
      lockProvider: new InMemoryLockProvider(clock),
      clock,
    });

    const decision = await dispatcher.dispatch("job-1");
    expect(decision).toEqual({ jobId: "job-1", dispatched: true });
  });

  it("denies dispatch when a policy rejects", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture());
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const dispatcher = new JobDispatcher({
      store,
      policyPipeline: new PolicyPipeline([
        { name: "blackout", evaluate: () => ({ allowed: false, reason: "maintenance window" }) },
      ]),
      lockProvider: new InMemoryLockProvider(clock),
      clock,
    });

    const decision = await dispatcher.dispatch("job-1");
    expect(decision.dispatched).toBe(false);
    expect(decision.reason).toContain("maintenance window");
  });

  it("denies dispatch when the Distributed Lock is already held", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture());
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const lockProvider = new InMemoryLockProvider(clock);
    await lockProvider.acquire("scheduler:job:job-1", 30_000);

    const dispatcher = new JobDispatcher({
      store,
      policyPipeline: new PolicyPipeline(),
      lockProvider,
      clock,
    });

    const decision = await dispatcher.dispatch("job-1");
    expect(decision.dispatched).toBe(false);
    expect(decision.reason).toContain("locked");
  });

  it("throws SchedulerException for an unknown jobId", async () => {
    const clock = new MockClock();
    const dispatcher = new JobDispatcher({
      store: new InMemoryScheduleStore(),
      policyPipeline: new PolicyPipeline(),
      lockProvider: new InMemoryLockProvider(clock),
      clock,
    });
    await expect(dispatcher.dispatch("ghost")).rejects.toThrow(SchedulerException);
  });

  it("passes the job's tenantId and priority into the policy context", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ tenantId: "t-1", priority: JobPriority.CRITICAL }));
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    let observedTenantId: string | undefined;
    let observedPriority: JobPriority | undefined;
    const dispatcher = new JobDispatcher({
      store,
      policyPipeline: new PolicyPipeline([
        {
          name: "observer",
          evaluate: (context) => {
            observedTenantId = context.tenantId;
            observedPriority = context.priority;
            return { allowed: true };
          },
        },
      ]),
      lockProvider: new InMemoryLockProvider(clock),
      clock,
    });

    await dispatcher.dispatch("job-1");
    expect(observedTenantId).toBe("t-1");
    expect(observedPriority).toBe(JobPriority.CRITICAL);
  });
});
