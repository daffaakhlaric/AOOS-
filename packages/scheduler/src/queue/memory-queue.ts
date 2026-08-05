import type { IQueue } from "./i-queue.js";

/** A simple in-memory FIFO queue — O(1) enqueue/dequeue via a head index instead of `Array.shift()`. */
export class MemoryQueue<T> implements IQueue<T> {
  private readonly items: T[] = [];
  private head = 0;

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    if (this.head >= this.items.length) {
      return undefined;
    }
    const item = this.items[this.head];
    this.items[this.head] = undefined as unknown as T;
    this.head += 1;
    if (this.head > 64 && this.head * 2 > this.items.length) {
      this.items.splice(0, this.head);
      this.head = 0;
    }
    return item;
  }

  peek(): T | undefined {
    return this.head < this.items.length ? this.items[this.head] : undefined;
  }

  get size(): number {
    return this.items.length - this.head;
  }

  clear(): void {
    this.items.length = 0;
    this.head = 0;
  }
}
