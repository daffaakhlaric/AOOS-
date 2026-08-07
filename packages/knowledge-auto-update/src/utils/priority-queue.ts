/**
 * Real binary min-heap. `compare(a, b) < 0` means `a` dequeues before `b`. Ties (equal `compare`
 * result) are broken FIFO by insertion order, so ordering is fully deterministic.
 */
export class PriorityQueue<T> {
  private readonly heap: Array<{ item: T; seq: number }> = [];
  private readonly compare: (a: T, b: T) => number;
  private nextSeq = 0;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  enqueue(item: T): void {
    const entry = { item, seq: this.nextSeq++ };
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  peek(): T | undefined {
    return this.heap[0]?.item;
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top.item;
  }

  toSortedArray(): T[] {
    const clone = new PriorityQueue<T>(this.compare);
    for (const entry of this.heap) clone.enqueue(entry.item);
    const result: T[] = [];
    let next = clone.dequeue();
    while (next !== undefined) {
      result.push(next);
      next = clone.dequeue();
    }
    return result;
  }

  private entryCompare(a: { item: T; seq: number }, b: { item: T; seq: number }): number {
    const primary = this.compare(a.item, b.item);
    return primary !== 0 ? primary : a.seq - b.seq;
  }

  private bubbleUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.entryCompare(this.heap[i]!, this.heap[parent]!) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
        i = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    let i = index;
    const n = this.heap.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && this.entryCompare(this.heap[left]!, this.heap[smallest]!) < 0) {
        smallest = left;
      }
      if (right < n && this.entryCompare(this.heap[right]!, this.heap[smallest]!) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
      i = smallest;
    }
  }
}
