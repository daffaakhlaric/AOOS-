import type { JobRecord } from "../entities/job.js";

/**
 * Schedule Store port (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "SCHEDULE STORE").
 * `store-interface/in-memory-schedule-store.ts` is the only implementation in this
 * package — "Belum membuat PostgreSQL. Belum membuat Redis." The caller (`scheduler/
 * scheduler.ts`) is responsible for building the full `JobRecord` (id/timestamps/initial
 * state) before calling `create()` — the Store only persists, it doesn't generate.
 */
export interface IScheduleStore {
  create(job: JobRecord): Promise<JobRecord>;
  get(jobId: string): Promise<JobRecord | undefined>;
  list(tenantId?: string): Promise<readonly JobRecord[]>;
  update(jobId: string, updates: Partial<JobRecord>): Promise<JobRecord>;
  delete(jobId: string): Promise<void>;
  /** Every `WAITING` job whose `nextFireAt` is at or before `asOf` — what `timer/timer-service.ts` polls each tick. */
  listDue(asOf: Date): Promise<readonly JobRecord[]>;
  /** Every job depending on `jobId`, regardless of state — what `trigger/dependency-trigger.ts` re-checks when a job completes. */
  listDependents(jobId: string): Promise<readonly JobRecord[]>;
}
