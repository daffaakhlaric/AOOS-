import { MemoryBuffer } from "./memory-buffer.js";

/** Batch Queue — accumulates items and drains them in bounded-size batches (backs PublishBatch). */
export class BatchQueue<T> {
  private readonly buffer = new MemoryBuffer<T>();

  enqueue(item: T): void {
    this.buffer.enqueue(item);
  }

  enqueueAll(items: readonly T[]): void {
    for (const item of items) {
      this.buffer.enqueue(item);
    }
  }

  drainBatch(maxSize: number): T[] {
    const batch: T[] = [];
    while (batch.length < maxSize) {
      const item = this.buffer.dequeue();
      if (item === undefined) {
        break;
      }
      batch.push(item);
    }
    return batch;
  }

  get size(): number {
    return this.buffer.size;
  }
}
