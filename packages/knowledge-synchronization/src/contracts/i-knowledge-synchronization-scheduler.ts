import type { KnowledgeSynchronizationScheduleEntry } from "../scheduler/knowledge-synchronization-schedule-entry.js";

/**
 * Interface only — no implementation in this package. An external pluggable scheduling
 * backend (e.g. a real cron daemon) `KnowledgeSynchronizationScheduler` may optionally
 * delegate to — the concrete `KnowledgeSynchronizationScheduler` class always keeps its
 * own in-memory job ledger regardless of whether one is configured.
 */
export interface IKnowledgeSynchronizationScheduler {
  schedule(entry: KnowledgeSynchronizationScheduleEntry): void | Promise<void>;
  cancel(id: string): void | Promise<void>;
}
