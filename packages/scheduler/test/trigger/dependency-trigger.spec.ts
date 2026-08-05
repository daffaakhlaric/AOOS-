import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { JobState } from "../../src/contracts/job-state.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { InMemoryScheduleStore } from "../../src/store-interface/in-memory-schedule-store.js";
import { DependencyTrigger } from "../../src/trigger/dependency-trigger.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("Dependency Test — DependencyTrigger", () => {
  it("readies a dependent once its single dependency completes", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ jobId: "upstream", state: JobState.COMPLETED }));
    await store.create(
      jobFixture({
        jobId: "downstream",
        state: JobState.WAITING,
        schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["upstream"] },
      }),
    );

    const trigger = new DependencyTrigger(store, new MockClock("2026-01-01T00:00:00.000Z"));
    const readied = await trigger.onJobCompleted("upstream");

    expect(readied.map((job) => job.jobId)).toEqual(["downstream"]);
    expect((await store.get("downstream"))?.state).toBe(JobState.READY);
  });

  it("Chain Dependency: does not ready a dependent until every dependency is complete", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ jobId: "a", state: JobState.COMPLETED }));
    await store.create(jobFixture({ jobId: "b", state: JobState.RUNNING }));
    await store.create(
      jobFixture({
        jobId: "downstream",
        state: JobState.WAITING,
        schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["a", "b"] },
      }),
    );

    const trigger = new DependencyTrigger(store, new MockClock());
    const readied = await trigger.onJobCompleted("a");

    expect(readied).toEqual([]);
    expect((await store.get("downstream"))?.state).toBe(JobState.WAITING);
  });

  it("readies a chain once the last dependency also completes", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ jobId: "a", state: JobState.COMPLETED }));
    await store.create(jobFixture({ jobId: "b", state: JobState.COMPLETED }));
    await store.create(
      jobFixture({
        jobId: "downstream",
        state: JobState.WAITING,
        schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["a", "b"] },
      }),
    );

    const trigger = new DependencyTrigger(store, new MockClock());
    const readied = await trigger.onJobCompleted("b");
    expect(readied.map((job) => job.jobId)).toEqual(["downstream"]);
  });

  it("ignores a dependent that is not in Waiting state", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ jobId: "upstream", state: JobState.COMPLETED }));
    await store.create(
      jobFixture({
        jobId: "downstream",
        state: JobState.PAUSED,
        schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["upstream"] },
      }),
    );

    const trigger = new DependencyTrigger(store, new MockClock());
    expect(await trigger.onJobCompleted("upstream")).toEqual([]);
  });

  it("returns an empty array when nothing depends on the completed job", async () => {
    const store = new InMemoryScheduleStore();
    const trigger = new DependencyTrigger(store, new MockClock());
    expect(await trigger.onJobCompleted("nobody-depends-on-me")).toEqual([]);
  });
});
