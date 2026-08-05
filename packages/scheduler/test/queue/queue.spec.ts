import { describe, expect, it } from "vitest";

import { JobPriority } from "../../src/contracts/job-priority.js";
import { DelayedQueue } from "../../src/queue/delayed-queue.js";
import { JobPriorityQueue } from "../../src/queue/job-priority-queue.js";
import { MemoryQueue } from "../../src/queue/memory-queue.js";
import { ReadyQueue } from "../../src/queue/ready-queue.js";
import { RetryQueue } from "../../src/queue/retry-queue.js";

describe("Queue Test — MemoryQueue", () => {
  it("dequeues in FIFO order", () => {
    const queue = new MemoryQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    expect(queue.dequeue()).toBe(1);
    expect(queue.dequeue()).toBe(2);
    expect(queue.size).toBe(1);
  });

  it("peek() returns the head without removing it", () => {
    const queue = new MemoryQueue<number>();
    queue.enqueue(1);
    expect(queue.peek()).toBe(1);
    expect(queue.size).toBe(1);
  });

  it("peek()/dequeue() on an empty queue return undefined", () => {
    const queue = new MemoryQueue<number>();
    expect(queue.peek()).toBeUndefined();
    expect(queue.dequeue()).toBeUndefined();
  });

  it("clear() empties the queue", () => {
    const queue = new MemoryQueue<number>();
    queue.enqueue(1);
    queue.clear();
    expect(queue.size).toBe(0);
  });

  it("compacts internal storage after many dequeues without losing remaining items", () => {
    const queue = new MemoryQueue<number>();
    for (let i = 0; i < 200; i += 1) {
      queue.enqueue(i);
    }
    for (let i = 0; i < 150; i += 1) {
      expect(queue.dequeue()).toBe(i);
    }
    expect(queue.size).toBe(50);
  });
});

describe("Queue Test — JobPriorityQueue", () => {
  it("drains highest priority first, FIFO within the same priority", () => {
    const queue = new JobPriorityQueue<string>();
    queue.enqueue("low-1", JobPriority.LOW);
    queue.enqueue("critical-1", JobPriority.CRITICAL);
    queue.enqueue("normal-1", JobPriority.NORMAL);
    queue.enqueue("critical-2", JobPriority.CRITICAL);

    expect(queue.dequeue()).toBe("critical-1");
    expect(queue.dequeue()).toBe("critical-2");
    expect(queue.dequeue()).toBe("normal-1");
    expect(queue.dequeue()).toBe("low-1");
    expect(queue.dequeue()).toBeUndefined();
  });

  it("size reflects the total across every priority bucket", () => {
    const queue = new JobPriorityQueue<string>();
    queue.enqueue("a", JobPriority.HIGH);
    queue.enqueue("b", JobPriority.BACKGROUND);
    expect(queue.size).toBe(2);
  });

  it("clear() empties every bucket", () => {
    const queue = new JobPriorityQueue<string>();
    queue.enqueue("a", JobPriority.HIGH);
    queue.clear();
    expect(queue.size).toBe(0);
  });
});

describe("Queue Test — ReadyQueue", () => {
  it("enqueueJob delegates to the underlying priority queue", () => {
    const queue = new ReadyQueue();
    queue.enqueueJob("job-1", JobPriority.CRITICAL);
    queue.enqueueJob("job-2", JobPriority.LOW);
    expect(queue.dequeue()).toBe("job-1");
    expect(queue.dequeue()).toBe("job-2");
  });
});

describe("Queue Test — DelayedQueue / RetryQueue", () => {
  it("drainDue returns every entry at or before `asOf`, earliest first", () => {
    const queue = new DelayedQueue();
    queue.enqueue("job-c", new Date("2026-01-03T00:00:00.000Z"));
    queue.enqueue("job-a", new Date("2026-01-01T00:00:00.000Z"));
    queue.enqueue("job-b", new Date("2026-01-02T00:00:00.000Z"));

    const due = queue.drainDue(new Date("2026-01-02T00:00:00.000Z"));
    expect(due).toEqual(["job-a", "job-b"]);
    expect(queue.size).toBe(1);
  });

  it("drainDue returns nothing when no entry is due", () => {
    const queue = new DelayedQueue();
    queue.enqueue("job-a", new Date("2026-01-05T00:00:00.000Z"));
    expect(queue.drainDue(new Date("2026-01-01T00:00:00.000Z"))).toEqual([]);
  });

  it("clear() empties the queue", () => {
    const queue = new DelayedQueue();
    queue.enqueue("job-a", new Date());
    queue.clear();
    expect(queue.size).toBe(0);
  });

  it("RetryQueue behaves identically (fireAt-ordered)", () => {
    const queue = new RetryQueue();
    queue.enqueue("job-b", new Date("2026-01-02T00:00:00.000Z"));
    queue.enqueue("job-a", new Date("2026-01-01T00:00:00.000Z"));
    expect(queue.drainDue(new Date("2026-01-02T00:00:00.000Z"))).toEqual(["job-a", "job-b"]);
  });
});
