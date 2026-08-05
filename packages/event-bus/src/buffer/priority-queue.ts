import { EVENT_PRIORITY_ORDER, type EventPriority } from "../contracts/event-priority.js";

import { MemoryBuffer } from "./memory-buffer.js";

/** Priority Queue — drains highest-priority items first; FIFO within the same priority. */
export class PriorityQueue<T> {
  private readonly buckets = new Map<EventPriority, MemoryBuffer<T>>(
    EVENT_PRIORITY_ORDER.map((priority) => [priority, new MemoryBuffer<T>()]),
  );

  enqueue(item: T, priority: EventPriority): void {
    this.buckets.get(priority)!.enqueue(item);
  }

  dequeue(): T | undefined {
    for (const priority of EVENT_PRIORITY_ORDER) {
      const bucket = this.buckets.get(priority)!;
      if (bucket.size > 0) {
        return bucket.dequeue();
      }
    }
    return undefined;
  }

  get size(): number {
    let total = 0;
    for (const bucket of this.buckets.values()) {
      total += bucket.size;
    }
    return total;
  }

  clear(): void {
    for (const bucket of this.buckets.values()) {
      bucket.clear();
    }
  }
}
