import { describe, expect, it } from "vitest";

import { KnowledgeIndexScheduler } from "../../src/scheduler/knowledge-index-scheduler.js";

describe("Scheduler Test — edge cases", () => {
  it("start() moves a job from pending to running", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.reindex("a-1");
    const started = scheduler.start(job.id);
    expect(started.status).toBe("running");
    expect(started.startedAt).toBeTruthy();
  });

  it("full() schedules a job with no assetId", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.full();
    expect(job.assetId).toBeUndefined();
  });

  it("list() with no jobs returns an empty array", () => {
    const scheduler = new KnowledgeIndexScheduler();
    expect(scheduler.list()).toEqual([]);
  });

  it("get() returns the same job instance registered by schedule()", () => {
    const scheduler = new KnowledgeIndexScheduler();
    const job = scheduler.reindex("a-1");
    expect(scheduler.get(job.id)).toBe(job);
  });
});
