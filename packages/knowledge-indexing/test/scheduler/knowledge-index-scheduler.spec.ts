import { describe, expect, it } from "vitest";

import { IndexScheduleException } from "../../src/errors/index-schedule-exception.js";
import { KnowledgeIndexScheduleJobType } from "../../src/scheduler/knowledge-index-schedule-job-type.js";
import { KnowledgeIndexScheduler } from "../../src/scheduler/knowledge-index-scheduler.js";

describe("Scheduler Test — KnowledgeIndexScheduler", () => {
  it("reindex()/incremental()/full()/onVersionUpdate()/onPolicyUpdate()/onRelationshipUpdate() schedule the matching job type", () => {
    const scheduler = new KnowledgeIndexScheduler();
    expect(scheduler.reindex("a-1").type).toBe(KnowledgeIndexScheduleJobType.REINDEX);
    expect(scheduler.incremental("a-1").type).toBe(KnowledgeIndexScheduleJobType.INCREMENTAL);
    expect(scheduler.full().type).toBe(KnowledgeIndexScheduleJobType.FULL);
    expect(scheduler.onVersionUpdate("a-1").type).toBe(
      KnowledgeIndexScheduleJobType.VERSION_UPDATE,
    );
    expect(scheduler.onPolicyUpdate("a-1").type).toBe(KnowledgeIndexScheduleJobType.POLICY_UPDATE);
    expect(scheduler.onRelationshipUpdate("a-1").type).toBe(
      KnowledgeIndexScheduleJobType.RELATIONSHIP_UPDATE,
    );
  });

  it("schedule() jobs start 'pending'", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.reindex("a-1");
    expect(job.status).toBe("pending");
  });

  it("start()/complete() move a job through running to completed", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.reindex("a-1");
    scheduler.start(job.id);
    const completed = scheduler.complete(job.id);
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();
  });

  it("fail() records a reason", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.reindex("a-1");
    const failed = scheduler.fail(job.id, "boom");
    expect(failed.status).toBe("failed");
    expect(failed.reason).toBe("boom");
  });

  it("cancel() only succeeds for a pending job", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.reindex("a-1");
    const cancelled = scheduler.cancel(job.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("cancel() throws IndexScheduleException for a non-pending job", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.reindex("a-1");
    scheduler.start(job.id);
    expect(() => scheduler.cancel(job.id)).toThrow(IndexScheduleException);
  });

  it("require() throws IndexScheduleException for an unknown job id", () => {
    const scheduler = new KnowledgeIndexScheduler();
    expect(() => scheduler.require("missing")).toThrow(IndexScheduleException);
  });

  it("get() returns undefined for an unknown job id", () => {
    const scheduler = new KnowledgeIndexScheduler();
    expect(scheduler.get("missing")).toBeUndefined();
  });

  it("list() filters by status when provided", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job1 = scheduler.reindex("a-1");
    scheduler.reindex("a-2");
    scheduler.complete(job1.id);
    expect(scheduler.list("completed")).toHaveLength(1);
    expect(scheduler.list()).toHaveLength(2);
  });
});
