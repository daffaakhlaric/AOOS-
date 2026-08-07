import { describe, expect, it } from "vitest";

import { PriorityQueue } from "../../src/utils/priority-queue.js";

function numericQueue(): PriorityQueue<number> {
  return new PriorityQueue<number>((a, b) => a - b);
}

describe("PriorityQueue", () => {
  it("starts empty", () => {
    const q = numericQueue();
    expect(q.isEmpty()).toBe(true);
    expect(q.size).toBe(0);
    expect(q.peek()).toBeUndefined();
    expect(q.dequeue()).toBeUndefined();
  });

  it("dequeues the single enqueued item", () => {
    const q = numericQueue();
    q.enqueue(5);
    expect(q.size).toBe(1);
    expect(q.dequeue()).toBe(5);
    expect(q.isEmpty()).toBe(true);
  });

  it("dequeues items in ascending order for a min-heap comparator", () => {
    const q = numericQueue();
    for (const n of [5, 1, 4, 2, 3]) q.enqueue(n);
    const out: number[] = [];
    let next = q.dequeue();
    while (next !== undefined) {
      out.push(next);
      next = q.dequeue();
    }
    expect(out).toEqual([1, 2, 3, 4, 5]);
  });

  it("peek does not remove the item", () => {
    const q = numericQueue();
    q.enqueue(9);
    expect(q.peek()).toBe(9);
    expect(q.size).toBe(1);
  });

  it("breaks ties FIFO by insertion order", () => {
    interface Item {
      readonly label: string;
      readonly priority: number;
    }
    const q = new PriorityQueue<Item>((a, b) => a.priority - b.priority);
    q.enqueue({ label: "first", priority: 1 });
    q.enqueue({ label: "second", priority: 1 });
    q.enqueue({ label: "third", priority: 1 });
    expect(q.dequeue()?.label).toBe("first");
    expect(q.dequeue()?.label).toBe("second");
    expect(q.dequeue()?.label).toBe("third");
  });

  it("supports a max-heap comparator (reversed)", () => {
    const q = new PriorityQueue<number>((a, b) => b - a);
    for (const n of [1, 5, 3]) q.enqueue(n);
    expect(q.dequeue()).toBe(5);
    expect(q.dequeue()).toBe(3);
    expect(q.dequeue()).toBe(1);
  });

  it("toSortedArray returns full contents in dequeue order without mutating the queue", () => {
    const q = numericQueue();
    for (const n of [3, 1, 2]) q.enqueue(n);
    expect(q.toSortedArray()).toEqual([1, 2, 3]);
    expect(q.size).toBe(3);
  });

  it("handles a larger randomized-order dataset correctly", () => {
    const q = numericQueue();
    const values = [42, 7, 19, 3, 88, 1, 56, 23, 4, 99, 12, 0];
    for (const v of values) q.enqueue(v);
    const expected = [...values].sort((a, b) => a - b);
    expect(q.toSortedArray()).toEqual(expected);
  });

  it.each([10, 50, 200])("correctly sorts %i pseudo-randomly ordered items", (n) => {
    const q = numericQueue();
    const values: number[] = [];
    let seed = n * 7919;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = seed % 1000;
      values.push(v);
      q.enqueue(v);
    }
    const expected = [...values].sort((a, b) => a - b);
    expect(q.toSortedArray()).toEqual(expected);
  });

  it("handles enqueue/dequeue interleaving", () => {
    const q = numericQueue();
    q.enqueue(5);
    q.enqueue(1);
    expect(q.dequeue()).toBe(1);
    q.enqueue(3);
    q.enqueue(0);
    expect(q.dequeue()).toBe(0);
    expect(q.dequeue()).toBe(3);
    expect(q.dequeue()).toBe(5);
  });
});
