import { beforeEach, describe, expect, it } from "vitest";

import { JobNotFoundException } from "../../src/errors/job-not-found-exception.js";
import { KnowledgeUpdateRegistry } from "../../src/registry/knowledge-update-registry.js";
import { KnowledgeUpdateManager } from "../../src/services/knowledge-update-manager.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { ManualClock } from "../../src/utils/clock.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";

describe("KnowledgeUpdateManager", () => {
  beforeEach(resetFixtureState);

  function setup() {
    const registry = new KnowledgeUpdateRegistry();
    const clock = new ManualClock(0);
    const manager = new KnowledgeUpdateManager(registry, clock);
    return { registry, clock, manager };
  }

  it("createJob stores a Pending job and seeds history", () => {
    const { manager, registry } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: "p-1" });
    expect(job.status).toBe(KnowledgeUpdateJobStatus.Pending);
    expect(registry.getJob(job.id)).toBe(job);
    expect(manager.getHistory(job.id).entries).toHaveLength(1);
    expect(manager.getHistory(job.id).entries[0]!.reason).toBe("created");
  });

  it("getJob throws JobNotFoundException for unknown id", () => {
    const { manager } = setup();
    expect(() => manager.getJob("missing")).toThrow(JobNotFoundException);
  });

  it("findJob returns undefined for unknown id", () => {
    const { manager } = setup();
    expect(manager.findJob("missing")).toBeUndefined();
  });

  it("listJobs returns every created job", () => {
    const { manager } = setup();
    manager.createJob({ targetId: "t-1", policyId: "p-1" });
    manager.createJob({ targetId: "t-2", policyId: "p-1" });
    expect(manager.listJobs()).toHaveLength(2);
  });

  it("listJobsByStatus filters correctly", () => {
    const { manager } = setup();
    const a = manager.createJob({ targetId: "t-1", policyId: "p-1" });
    manager.createJob({ targetId: "t-2", policyId: "p-1" });
    manager.transitionStatus(a.id, KnowledgeUpdateJobStatus.Completed);
    expect(manager.listJobsByStatus(KnowledgeUpdateJobStatus.Completed)).toHaveLength(1);
    expect(manager.listJobsByStatus(KnowledgeUpdateJobStatus.Pending)).toHaveLength(1);
  });

  it("transitionStatus updates status and appends history", () => {
    const { manager, clock } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: "p-1" });
    clock.advance(100);
    const updated = manager.transitionStatus(job.id, KnowledgeUpdateJobStatus.Running, "started");
    expect(updated.status).toBe(KnowledgeUpdateJobStatus.Running);
    expect(updated.updatedAt).toBe(100);
    const history = manager.getHistory(job.id);
    expect(history.entries).toHaveLength(2);
    expect(history.entries[1]!.reason).toBe("started");
  });

  it("saveJob persists an externally-modified job and records history", () => {
    const { manager } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: "p-1" });
    const modified = job.withPriority(99, 0);
    manager.saveJob(modified, "priority_changed");
    expect(manager.getJob(job.id).priority).toBe(99);
  });

  it("saveJob seeds a fresh history when the job had none recorded yet", () => {
    const { manager, registry } = setup();
    // Register a job directly via the registry, bypassing manager.createJob's history seeding.
    const job = makeJob({ id: "bare-job" });
    registry.putJob(job);
    expect(manager.getHistory(job.id).entries).toHaveLength(0);
    manager.saveJob(job.withPriority(5, 0), "external_save");
    expect(manager.getHistory(job.id).entries).toHaveLength(1);
  });

  it("getHistory returns an empty history for a jobId with no recorded history at all", () => {
    const { manager } = setup();
    expect(manager.getHistory("never-created").entries).toEqual([]);
  });

  it("listJobs returns an empty array when nothing has been created", () => {
    const { manager } = setup();
    expect(manager.listJobs()).toEqual([]);
  });

  it("listJobsByStatus returns an empty array when no jobs match", () => {
    const { manager } = setup();
    manager.createJob({ targetId: "t-1", policyId: "p-1" });
    expect(manager.listJobsByStatus(KnowledgeUpdateJobStatus.Completed)).toEqual([]);
  });

  it("transitionStatus can be called multiple times in sequence", () => {
    const { manager } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: "p-1" });
    manager.transitionStatus(job.id, KnowledgeUpdateJobStatus.Scheduled);
    manager.transitionStatus(job.id, KnowledgeUpdateJobStatus.Running);
    const finalJob = manager.transitionStatus(job.id, KnowledgeUpdateJobStatus.Completed);
    expect(finalJob.status).toBe(KnowledgeUpdateJobStatus.Completed);
    expect(manager.getHistory(job.id).entries).toHaveLength(4);
  });

  it("removeJob deletes the job from the registry", () => {
    const { manager, registry } = setup();
    const job = manager.createJob({ targetId: "t-1", policyId: "p-1" });
    manager.removeJob(job.id);
    expect(registry.hasJob(job.id)).toBe(false);
  });
});
