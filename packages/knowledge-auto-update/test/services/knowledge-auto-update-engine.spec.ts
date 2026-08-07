import { beforeEach, describe, expect, it } from "vitest";

import { JobNotFoundException } from "../../src/errors/job-not-found-exception.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEventType } from "../../src/events/knowledge-auto-update-event-type.js";
import { KnowledgeAutoUpdateEngine } from "../../src/services/knowledge-auto-update-engine.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { ManualClock } from "../../src/utils/clock.js";
import { resetFixtureState } from "../helpers/fixtures.js";

describe("KnowledgeAutoUpdateEngine", () => {
  beforeEach(resetFixtureState);

  function setup() {
    const clock = new ManualClock(0);
    const eventPublisher = new InMemoryEventPublisher(clock);
    const engine = new KnowledgeAutoUpdateEngine({ clock, eventPublisher });
    return { clock, eventPublisher, engine };
  }

  it("has a stable id and implements start/stop without throwing", async () => {
    const { engine } = setup();
    expect(typeof engine.id).toBe("string");
    await engine.start();
    await engine.stop();
  });

  it("seeds a default policy usable by scheduleJob", () => {
    const { engine } = setup();
    expect(() => engine.getPolicy(engine.defaultPolicyId)).not.toThrow();
  });

  it("registerPolicy adds a retrievable custom policy", () => {
    const { engine } = setup();
    const policy = engine.registerPolicy({ name: "custom" });
    expect(engine.getPolicy(policy.id).name).toBe("custom");
  });

  it("scheduleJob creates and schedules a job, publishing UpdateScheduled", () => {
    const { engine, eventPublisher } = setup();
    const job = engine.scheduleJob({
      targetId: "target-1",
      updateType: KnowledgeUpdateType.Manual,
    });
    expect(job.status).toBe(KnowledgeUpdateJobStatus.Scheduled);
    expect(engine.getJob(job.id)).toEqual(job);
    expect(
      eventPublisher
        .getHistory()
        .some((e) => e.eventType === KnowledgeAutoUpdateEventType.UpdateScheduled),
    ).toBe(true);
  });

  it("scheduleJob uses the default policy when none is specified", () => {
    const { engine } = setup();
    const job = engine.scheduleJob({ targetId: "target-1" });
    expect(job.policyId).toBe(engine.defaultPolicyId);
  });

  it("scheduleJob honors an explicit policyId", () => {
    const { engine } = setup();
    const policy = engine.registerPolicy({ name: "explicit" });
    const job = engine.scheduleJob({ targetId: "target-1", policyId: policy.id });
    expect(job.policyId).toBe(policy.id);
  });

  it("tick() runs due jobs and completes them", () => {
    const { engine, clock } = setup();
    const job = engine.scheduleJob({
      targetId: "target-1",
      updateType: KnowledgeUpdateType.Manual,
      payload: { a: 1 },
    });
    engine.tick(clock.now());
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("tick() defaults to the injected clock's current time", () => {
    const { engine, clock } = setup();
    engine.scheduleJob({ targetId: "target-1" });
    clock.set(500);
    const session = engine.tick();
    expect(session.startedAt).toBe(500);
  });

  it("pauseJob/resumeJob/cancelJob delegate correctly", () => {
    const { engine } = setup();
    const job = engine.scheduleJob({ targetId: "target-1" });
    engine.pauseJob(job.id);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Paused);
    engine.resumeJob(job.id);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Scheduled);
    engine.cancelJob(job.id);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Cancelled);
  });

  it("getJob throws JobNotFoundException for an unknown id", () => {
    const { engine } = setup();
    expect(() => engine.getJob("missing")).toThrow(JobNotFoundException);
  });

  it("listJobs and listJobsByStatus reflect current state", () => {
    const { engine } = setup();
    const a = engine.scheduleJob({ targetId: "t-1" });
    engine.scheduleJob({ targetId: "t-2" });
    engine.cancelJob(a.id);
    expect(engine.listJobs()).toHaveLength(2);
    expect(engine.listJobsByStatus(KnowledgeUpdateJobStatus.Cancelled)).toHaveLength(1);
  });

  it("getMetrics reflects job counts and computed rates after a tick", () => {
    const { engine, clock } = setup();
    engine.scheduleJob({ targetId: "t-1", updateType: KnowledgeUpdateType.Manual, payload: {} });
    engine.tick(clock.now());
    const metrics = engine.getMetrics();
    expect(metrics.updateCount).toBe(1);
    expect(metrics.successCount).toBe(1);
    expect(metrics.completedJobs).toBe(1);
    expect(metrics.successRate).toBe(1);
  });

  it("getSnapshot reflects pending/completed/cancelled/queue counts", () => {
    const { engine, clock } = setup();
    const a = engine.scheduleJob({ targetId: "t-1", payload: {} });
    engine.scheduleJob({
      targetId: "t-2",
      schedule: { kind: ScheduleKind.Scheduled, runAt: 100_000 },
    });
    engine.tick(clock.now());
    const snapshot = engine.getSnapshot();
    expect(snapshot.completedJobCount).toBe(1);
    expect(snapshot.pendingJobCount).toBe(1);
    expect(snapshot.queueSize).toBe(1);
    void a;
  });

  it("expireStaleJobs marks old pending jobs as Expired and cancels their schedule", () => {
    const { engine, clock } = setup();
    const shortLivedPolicy = engine.registerPolicy({ name: "short-lived", expireAfterMs: 100 });
    const job = engine.scheduleJob({
      targetId: "t-1",
      policyId: shortLivedPolicy.id,
      schedule: { kind: ScheduleKind.Scheduled, runAt: 100_000 },
    });
    clock.set(1000);
    const expired = engine.expireStaleJobs(clock.now());
    expect(expired).toHaveLength(1);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Expired);
  });

  it("expireStaleJobs skips jobs that are not Pending/Scheduled (e.g. already Completed)", () => {
    const { engine, clock } = setup();
    const shortLivedPolicy = engine.registerPolicy({ name: "short-lived-2", expireAfterMs: 1 });
    const job = engine.scheduleJob({
      targetId: "t-1",
      policyId: shortLivedPolicy.id,
      updateType: KnowledgeUpdateType.Manual,
      payload: {},
    });
    engine.tick(clock.now()); // completes immediately
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
    clock.set(10_000);
    const expired = engine.expireStaleJobs(clock.now());
    expect(expired).toHaveLength(0);
    expect(engine.getJob(job.id).status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("expireStaleJobs does not expire jobs within their freshness window", () => {
    const { engine, clock } = setup();
    engine.scheduleJob({
      targetId: "t-1",
      schedule: { kind: ScheduleKind.Scheduled, runAt: 100_000 },
    });
    const expired = engine.expireStaleJobs(clock.now());
    expect(expired).toHaveLength(0);
  });

  it("scheduleJob accepts an explicit dependsOn list", () => {
    const { engine } = setup();
    const a = engine.scheduleJob({ targetId: "t-a" });
    const b = engine.scheduleJob({ targetId: "t-b", dependsOn: [a.id] });
    expect(b.dependsOn).toEqual([a.id]);
  });

  it("scheduleJob accepts an explicit priority", () => {
    const { engine } = setup();
    const job = engine.scheduleJob({ targetId: "t-1", priority: 42 });
    expect(job.priority).toBe(42);
  });

  it("registerPolicy returns distinct ids for successive calls", () => {
    const { engine } = setup();
    const a = engine.registerPolicy({ name: "a" });
    const b = engine.registerPolicy({ name: "b" });
    expect(a.id).not.toBe(b.id);
  });

  it("getSnapshot's takenAt reflects the injected clock", () => {
    const { engine, clock } = setup();
    clock.set(12345);
    expect(engine.getSnapshot().takenAt).toBe(12345);
  });

  it("tick() with nothing scheduled returns an empty, completed session", () => {
    const { engine, clock } = setup();
    const session = engine.tick(clock.now());
    expect(session.taskIds).toEqual([]);
  });

  it("uses a real SystemClock by default when no clock is injected", () => {
    const engine = new KnowledgeAutoUpdateEngine();
    const job = engine.scheduleJob({ targetId: "t-1" });
    expect(job.createdAt).toBeGreaterThan(0);
  });
});
