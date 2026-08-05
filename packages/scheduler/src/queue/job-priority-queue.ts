import { JOB_PRIORITY_ORDER, type JobPriority } from "../contracts/job-priority.js";

import { MemoryQueue } from "./memory-queue.js";

/** Priority Queue — drains highest Job Priority first; FIFO within the same priority. */
export class JobPriorityQueue<T> {
  private readonly buckets = new Map<JobPriority, MemoryQueue<T>>(
    JOB_PRIORITY_ORDER.map((priority) => [priority, new MemoryQueue<T>()]),
  );

  enqueue(item: T, priority: JobPriority): void {
    this.buckets.get(priority)!.enqueue(item);
  }

  dequeue(): T | undefined {
    for (const priority of JOB_PRIORITY_ORDER) {
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
