import { describe, expect, it } from "vitest";

import { KnowledgeUpdateJob } from "../../src/entities/knowledge-update-job.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";

function baseProps() {
  return {
    id: "job-1",
    updateType: KnowledgeUpdateType.Manual,
    targetId: "target-1",
    schedule: { kind: ScheduleKind.Immediate as const },
    policyId: "policy-1",
    status: KnowledgeUpdateJobStatus.Pending,
    priority: 0,
    dependsOn: [],
    attempt: 0,
    nextRunAt: undefined,
    payload: {},
    previousPayload: undefined,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("KnowledgeUpdateJob", () => {
  it("constructs with valid props", () => {
    const job = new KnowledgeUpdateJob(baseProps());
    expect(job.id).toBe("job-1");
    expect(job.status).toBe(KnowledgeUpdateJobStatus.Pending);
  });

  it("is frozen (immutable)", () => {
    const job = new KnowledgeUpdateJob(baseProps());
    expect(Object.isFrozen(job)).toBe(true);
    expect(Object.isFrozen(job.dependsOn)).toBe(true);
  });

  it("throws on empty id", () => {
    expect(() => new KnowledgeUpdateJob({ ...baseProps(), id: "" })).toThrow(RangeError);
  });

  it("throws on negative attempt", () => {
    expect(() => new KnowledgeUpdateJob({ ...baseProps(), attempt: -1 })).toThrow(RangeError);
  });

  describe("withStatus", () => {
    it("returns a new instance with the new status and updatedAt", () => {
      const job = new KnowledgeUpdateJob(baseProps());
      const updated = job.withStatus(KnowledgeUpdateJobStatus.Running, 100);
      expect(updated).not.toBe(job);
      expect(updated.status).toBe(KnowledgeUpdateJobStatus.Running);
      expect(updated.updatedAt).toBe(100);
      expect(job.status).toBe(KnowledgeUpdateJobStatus.Pending);
    });
  });

  describe("withPriority", () => {
    it("returns a new instance with the new priority", () => {
      const job = new KnowledgeUpdateJob(baseProps());
      const updated = job.withPriority(42, 50);
      expect(updated.priority).toBe(42);
      expect(updated.updatedAt).toBe(50);
    });
  });

  describe("withNextRunAt", () => {
    it("sets nextRunAt", () => {
      const job = new KnowledgeUpdateJob(baseProps());
      const updated = job.withNextRunAt(500, 10);
      expect(updated.nextRunAt).toBe(500);
    });

    it("can clear nextRunAt back to undefined", () => {
      const job = new KnowledgeUpdateJob({ ...baseProps(), nextRunAt: 500 });
      const updated = job.withNextRunAt(undefined, 10);
      expect(updated.nextRunAt).toBeUndefined();
    });
  });

  describe("withAttemptIncremented", () => {
    it("increments attempt by 1", () => {
      const job = new KnowledgeUpdateJob(baseProps());
      const updated = job.withAttemptIncremented(20);
      expect(updated.attempt).toBe(1);
      expect(job.attempt).toBe(0);
    });
  });

  it("supports chaining multiple with* calls without mutating intermediate instances", () => {
    const job = new KnowledgeUpdateJob(baseProps());
    const step1 = job.withStatus(KnowledgeUpdateJobStatus.Scheduled, 10);
    const step2 = step1.withPriority(5, 20);
    const step3 = step2.withAttemptIncremented(30);
    expect(job.status).toBe(KnowledgeUpdateJobStatus.Pending);
    expect(step1.priority).toBe(0);
    expect(step2.attempt).toBe(0);
    expect(step3.status).toBe(KnowledgeUpdateJobStatus.Scheduled);
    expect(step3.priority).toBe(5);
    expect(step3.attempt).toBe(1);
    expect(step3.updatedAt).toBe(30);
  });

  describe("withPayload", () => {
    it("sets payload and moves the old payload into previousPayload", () => {
      const job = new KnowledgeUpdateJob({ ...baseProps(), payload: { a: 1 } });
      const updated = job.withPayload({ a: 2 }, 30);
      expect(updated.payload).toEqual({ a: 2 });
      expect(updated.previousPayload).toEqual({ a: 1 });
    });
  });
});
