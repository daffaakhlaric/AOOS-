import type { JobPriority } from "../contracts/job-priority.js";

import { JobPriorityQueue } from "./job-priority-queue.js";

/** Ready Queue — jobIds waiting for `dispatcher/job-dispatcher.ts` to pick them up, drained in Priority order. */
export class ReadyQueue extends JobPriorityQueue<string> {
  enqueueJob(jobId: string, priority: JobPriority): void {
    this.enqueue(jobId, priority);
  }
}
