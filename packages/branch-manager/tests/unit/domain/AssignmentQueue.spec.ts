import { describe, expect, it } from "vitest";

import {
  AssignmentQueue,
  createQueuedLead,
  type QueuedLead,
} from "../../../src/domain/entities/AssignmentQueue.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const T0 = new Date("2026-01-15T09:00:00.000Z");

function lead(leadId: string, enqueuedAt: Date = T0): QueuedLead {
  return unwrap(createQueuedLead({ leadId, branchId: BranchId.BINTARO, enqueuedAt }));
}

describe("createQueuedLead", () => {
  it("creates a valid QueuedLead", () => {
    const result = unwrap(
      createQueuedLead({ leadId: "lead-1", branchId: BranchId.BINTARO, enqueuedAt: T0 }),
    );
    expect(result.leadId).toBe("lead-1");
    expect(result.branchId).toBe(BranchId.BINTARO);
    expect(result.enqueuedAt).toEqual(T0);
    expect(result.metadata).toBeUndefined();
  });

  it("accepts optional metadata", () => {
    const result = unwrap(
      createQueuedLead({
        leadId: "lead-1",
        branchId: BranchId.BINTARO,
        enqueuedAt: T0,
        metadata: { a: 1 },
      }),
    );
    expect(result.metadata).toEqual({ a: 1 });
  });

  it("rejects an empty leadId", () => {
    expect(
      unwrapErr(createQueuedLead({ leadId: "", branchId: BranchId.BINTARO, enqueuedAt: T0 }))
        .message,
    ).toContain("QueuedLead validation failed");
  });

  it("rejects an invalid branchId", () => {
    expect(
      unwrapErr(createQueuedLead({ leadId: "x", branchId: "NOT_A_BRANCH", enqueuedAt: T0 }))
        .message,
    ).toContain("QueuedLead validation failed");
  });

  it("rejects a non-Date enqueuedAt", () => {
    expect(
      unwrapErr(
        createQueuedLead({ leadId: "x", branchId: BranchId.BINTARO, enqueuedAt: "not-a-date" }),
      ).message,
    ).toContain("QueuedLead validation failed");
  });

  it("rejects a completely non-object input (root-level issue path)", () => {
    expect(unwrapErr(createQueuedLead("not-an-object")).message).toContain("(root)");
  });
});

describe("AssignmentQueue entity", () => {
  it("create() rejects a non-positive maxSize", () => {
    expect(unwrapErr(AssignmentQueue.create(BranchId.BINTARO, 0)).message).toContain(
      "must be a positive integer",
    );
  });

  it("create() rejects a non-integer maxSize", () => {
    expect(unwrapErr(AssignmentQueue.create(BranchId.BINTARO, 1.5)).message).toContain(
      "must be a positive integer",
    );
  });

  it("starts empty", () => {
    const queue = unwrap(AssignmentQueue.create(BranchId.BINTARO, 3));
    expect(queue.size).toBe(0);
    expect(queue.isFull).toBe(false);
    expect(queue.peekAll()).toEqual([]);
  });

  it("enqueue + dequeue preserves FIFO order", () => {
    const queue = unwrap(AssignmentQueue.create(BranchId.BINTARO, 3));
    const lead1 = lead("lead-1");
    const lead2 = lead("lead-2");
    const lead3 = lead("lead-3");

    const q1 = unwrap(queue.enqueue(lead1));
    const q2 = unwrap(q1.enqueue(lead2));
    const q3 = unwrap(q2.enqueue(lead3));
    expect(q3.size).toBe(3);
    expect(q3.peekAll()).toEqual([lead1, lead2, lead3]);

    const { queue: q4, lead: dequeued1 } = q3.dequeue();
    expect(dequeued1).toBe(lead1);
    const { queue: q5, lead: dequeued2 } = q4.dequeue();
    expect(dequeued2).toBe(lead2);
    expect(q5.size).toBe(1);
    expect(q5.peekAll()).toEqual([lead3]);
  });

  it("dequeue on an empty queue returns undefined and the same instance", () => {
    const queue = unwrap(AssignmentQueue.create(BranchId.BINTARO, 3));
    const { queue: next, lead: dequeued } = queue.dequeue();
    expect(dequeued).toBeUndefined();
    expect(next).toBe(queue);
  });

  it("enforces maxQueueSize — enqueue fails once full", () => {
    const queue = unwrap(AssignmentQueue.create(BranchId.BINTARO, 1));
    const q1 = unwrap(queue.enqueue(lead("lead-1")));
    expect(q1.isFull).toBe(true);
    const err = unwrapErr(q1.enqueue(lead("lead-2")));
    expect(err.message).toContain("is full");
  });

  it("removeExpired drops entries older than ttlMs and keeps fresh ones", () => {
    const queue = unwrap(AssignmentQueue.create(BranchId.BINTARO, 10));
    const old = lead("old", new Date("2026-01-01T00:00:00.000Z"));
    const fresh = lead("fresh", new Date("2026-01-15T08:59:00.000Z"));
    const q1 = unwrap(unwrap(queue.enqueue(old)).enqueue(fresh));

    const { queue: pruned, removed } = q1.removeExpired(T0, 60_000);
    expect(removed).toEqual([old]);
    expect(pruned.peekAll()).toEqual([fresh]);
  });

  it("removeExpired is a no-op (same instance) when nothing is stale", () => {
    const queue = unwrap(AssignmentQueue.create(BranchId.BINTARO, 10));
    const q1 = unwrap(queue.enqueue(lead("lead-1", T0)));
    const { queue: pruned, removed } = q1.removeExpired(T0, 60_000);
    expect(removed).toEqual([]);
    expect(pruned).toBe(q1);
  });
});
