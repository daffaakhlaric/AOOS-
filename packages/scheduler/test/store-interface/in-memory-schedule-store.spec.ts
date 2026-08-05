import { describe, expect, it } from "vitest";

import { JobState } from "../../src/contracts/job-state.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { SchedulerException } from "../../src/errors/scheduler-exception.js";
import { InMemoryScheduleStore } from "../../src/store-interface/in-memory-schedule-store.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("InMemoryScheduleStore", () => {
  it("create() stores and returns the job", async () => {
    const store = new InMemoryScheduleStore();
    const job = jobFixture();
    const created = await store.create(job);
    expect(created).toEqual(job);
    expect(await store.get("job-1")).toEqual(job);
  });

  it("create() throws when the jobId already exists", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture());
    await expect(store.create(jobFixture())).rejects.toThrow(SchedulerException);
  });

  it("get() returns undefined for an unknown jobId", async () => {
    expect(await new InMemoryScheduleStore().get("ghost")).toBeUndefined();
  });

  it("list() returns every job, optionally filtered by tenantId", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ jobId: "job-1", tenantId: "t-1" }));
    await store.create(jobFixture({ jobId: "job-2", tenantId: "t-2" }));
    expect(await store.list()).toHaveLength(2);
    expect(await store.list("t-1")).toHaveLength(1);
  });

  it("update() merges changes and returns the updated record", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture());
    const updated = await store.update("job-1", { state: JobState.READY });
    expect(updated.state).toBe(JobState.READY);
    expect(await store.get("job-1")).toMatchObject({ state: JobState.READY });
  });

  it("update() throws for an unknown jobId", async () => {
    await expect(new InMemoryScheduleStore().update("ghost", {})).rejects.toThrow(
      SchedulerException,
    );
  });

  it("delete() removes the job", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture());
    await store.delete("job-1");
    expect(await store.get("job-1")).toBeUndefined();
  });

  it("delete() throws for an unknown jobId", async () => {
    await expect(new InMemoryScheduleStore().delete("ghost")).rejects.toThrow(SchedulerException);
  });

  it("listDue() returns Waiting/Retrying jobs whose nextFireAt has elapsed", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(
      jobFixture({ jobId: "due", state: JobState.WAITING, nextFireAt: "2026-01-01T00:00:00.000Z" }),
    );
    await store.create(
      jobFixture({
        jobId: "not-due",
        state: JobState.WAITING,
        nextFireAt: "2026-01-02T00:00:00.000Z",
      }),
    );
    await store.create(jobFixture({ jobId: "no-fire-time", state: JobState.WAITING }));
    await store.create(
      jobFixture({
        jobId: "retrying-due",
        state: JobState.RETRYING,
        nextFireAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    const due = await store.listDue(new Date("2026-01-01T00:00:00.000Z"));
    expect(due.map((job) => job.jobId).sort()).toEqual(["due", "retrying-due"]);
  });

  it("listDependents() returns Dependency jobs that depend on the given jobId", async () => {
    const store = new InMemoryScheduleStore();
    await store.create(jobFixture({ jobId: "upstream" }));
    await store.create(
      jobFixture({
        jobId: "downstream",
        schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["upstream"] },
      }),
    );
    await store.create(jobFixture({ jobId: "unrelated" }));

    const dependents = await store.listDependents("upstream");
    expect(dependents.map((job) => job.jobId)).toEqual(["downstream"]);
  });
});
