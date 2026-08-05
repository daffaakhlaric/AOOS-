import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";

/** Interface only — no implementation in this package. An external durable queue backend a caller may front `KnowledgeSynchronizationManager` with — this package's own Job bookkeeping is in-memory only. */
export interface IKnowledgeSynchronizationQueue {
  enqueue(job: KnowledgeSynchronizationJob): void | Promise<void>;
  dequeue():
    KnowledgeSynchronizationJob | undefined | Promise<KnowledgeSynchronizationJob | undefined>;
  size(): number | Promise<number>;
}
