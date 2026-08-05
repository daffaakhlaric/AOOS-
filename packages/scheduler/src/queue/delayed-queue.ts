interface DelayedEntry {
  readonly jobId: string;
  readonly fireAt: Date;
}

/** Delayed Queue — jobIds not yet due, kept sorted by `fireAt` so `drainDue()` only has to look at the front. */
export class DelayedQueue {
  private readonly entries: DelayedEntry[] = [];

  enqueue(jobId: string, fireAt: Date): void {
    const index = this.entries.findIndex((entry) => entry.fireAt.getTime() > fireAt.getTime());
    const entry: DelayedEntry = { jobId, fireAt };
    if (index === -1) {
      this.entries.push(entry);
    } else {
      this.entries.splice(index, 0, entry);
    }
  }

  /** Removes and returns every jobId whose `fireAt` is at or before `asOf`, earliest first. */
  drainDue(asOf: Date): readonly string[] {
    const due: string[] = [];
    while (this.entries.length > 0 && this.entries[0]!.fireAt.getTime() <= asOf.getTime()) {
      due.push(this.entries.shift()!.jobId);
    }
    return due;
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries.length = 0;
  }
}
