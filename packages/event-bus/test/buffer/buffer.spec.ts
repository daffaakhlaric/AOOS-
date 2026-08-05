import { describe, expect, it } from "vitest";

import { BatchQueue } from "../../src/buffer/batch-queue.js";
import { MemoryBuffer } from "../../src/buffer/memory-buffer.js";
import { PriorityQueue } from "../../src/buffer/priority-queue.js";
import { EventPriority } from "../../src/contracts/event-priority.js";

describe("MemoryBuffer", () => {
  it("dequeues in FIFO order", () => {
    const buffer = new MemoryBuffer<number>();
    buffer.enqueue(1);
    buffer.enqueue(2);
    buffer.enqueue(3);
    expect(buffer.dequeue()).toBe(1);
    expect(buffer.dequeue()).toBe(2);
    expect(buffer.size).toBe(1);
  });

  it("peek() returns the head without removing it", () => {
    const buffer = new MemoryBuffer<number>();
    buffer.enqueue(1);
    expect(buffer.peek()).toBe(1);
    expect(buffer.size).toBe(1);
  });

  it("peek() on an empty buffer returns undefined", () => {
    expect(new MemoryBuffer<number>().peek()).toBeUndefined();
  });

  it("dequeue() on an empty buffer returns undefined", () => {
    expect(new MemoryBuffer<number>().dequeue()).toBeUndefined();
  });

  it("clear() empties the buffer", () => {
    const buffer = new MemoryBuffer<number>();
    buffer.enqueue(1);
    buffer.clear();
    expect(buffer.size).toBe(0);
    expect(buffer.dequeue()).toBeUndefined();
  });

  it("compacts internal storage after many dequeues without losing remaining items", () => {
    const buffer = new MemoryBuffer<number>();
    for (let i = 0; i < 200; i += 1) {
      buffer.enqueue(i);
    }
    for (let i = 0; i < 150; i += 1) {
      expect(buffer.dequeue()).toBe(i);
    }
    expect(buffer.size).toBe(50);
    expect(buffer.dequeue()).toBe(150);
  });
});

describe("PriorityQueue", () => {
  it("drains highest priority first, FIFO within the same priority", () => {
    const queue = new PriorityQueue<string>();
    queue.enqueue("low-1", EventPriority.LOW);
    queue.enqueue("critical-1", EventPriority.CRITICAL);
    queue.enqueue("normal-1", EventPriority.NORMAL);
    queue.enqueue("critical-2", EventPriority.CRITICAL);

    expect(queue.dequeue()).toBe("critical-1");
    expect(queue.dequeue()).toBe("critical-2");
    expect(queue.dequeue()).toBe("normal-1");
    expect(queue.dequeue()).toBe("low-1");
    expect(queue.dequeue()).toBeUndefined();
  });

  it("size reflects the total across every priority bucket", () => {
    const queue = new PriorityQueue<string>();
    queue.enqueue("a", EventPriority.HIGH);
    queue.enqueue("b", EventPriority.BACKGROUND);
    expect(queue.size).toBe(2);
  });

  it("clear() empties every bucket", () => {
    const queue = new PriorityQueue<string>();
    queue.enqueue("a", EventPriority.HIGH);
    queue.clear();
    expect(queue.size).toBe(0);
  });
});

describe("BatchQueue", () => {
  it("drainBatch returns up to maxSize items, FIFO", () => {
    const queue = new BatchQueue<number>();
    queue.enqueueAll([1, 2, 3, 4, 5]);
    expect(queue.drainBatch(3)).toEqual([1, 2, 3]);
    expect(queue.size).toBe(2);
    expect(queue.drainBatch(10)).toEqual([4, 5]);
  });

  it("drainBatch on an empty queue returns an empty array", () => {
    expect(new BatchQueue<number>().drainBatch(5)).toEqual([]);
  });

  it("enqueue() adds a single item", () => {
    const queue = new BatchQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    expect(queue.drainBatch(10)).toEqual([1, 2]);
  });
});
