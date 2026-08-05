import type { IKnowledgeSynchronizationScheduler } from "../contracts/i-knowledge-synchronization-scheduler.js";
import type { KnowledgeSynchronizationScheduleType } from "../domain/knowledge-synchronization-schedule-type.js";
import { ScheduleNotFoundException } from "../errors/schedule-not-found-exception.js";
import { generateId } from "../utils/id.js";

import type { KnowledgeSynchronizationScheduleEntry } from "./knowledge-synchronization-schedule-entry.js";

export interface ScheduleInput {
  readonly jobId: string;
  readonly scheduleType: KnowledgeSynchronizationScheduleType;
  readonly cronExpression?: string;
  readonly intervalMs?: number;
  readonly runAt?: string;
}

/**
 * "SCHEDULER: Support Cron, Interval, One Time, Manual Trigger, Event Trigger (interface
 * only)." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — an in-memory job ledger
 * tracking Schedule requests through pending → triggered/cancelled, mirroring
 * `@aos/knowledge-indexing`'s `KnowledgeIndexScheduler`. Never performs the actual sync
 * work itself — a caller reacts to a triggered Schedule by calling
 * `KnowledgeSynchronization.synchronize()`. Optionally delegates the "when to fire"
 * concern to an external `IKnowledgeSynchronizationScheduler` backend when one is
 * configured; the in-memory ledger is always kept regardless.
 */
export class KnowledgeSynchronizationScheduler {
  private readonly entriesById = new Map<string, KnowledgeSynchronizationScheduleEntry>();

  constructor(private readonly externalScheduler?: IKnowledgeSynchronizationScheduler) {}

  async schedule(input: ScheduleInput): Promise<KnowledgeSynchronizationScheduleEntry> {
    const entry: KnowledgeSynchronizationScheduleEntry = {
      id: generateId(),
      scheduleType: input.scheduleType,
      jobId: input.jobId,
      cronExpression: input.cronExpression,
      intervalMs: input.intervalMs,
      runAt: input.runAt,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.entriesById.set(entry.id, entry);
    if (this.externalScheduler) {
      await this.externalScheduler.schedule(entry);
    }
    return entry;
  }

  trigger(id: string): KnowledgeSynchronizationScheduleEntry {
    const entry = this.require(id);
    const triggered: KnowledgeSynchronizationScheduleEntry = {
      ...entry,
      status: "triggered",
      triggeredAt: new Date().toISOString(),
    };
    this.entriesById.set(id, triggered);
    return triggered;
  }

  async cancel(id: string): Promise<KnowledgeSynchronizationScheduleEntry> {
    const entry = this.require(id);
    const cancelled: KnowledgeSynchronizationScheduleEntry = {
      ...entry,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    this.entriesById.set(id, cancelled);
    if (this.externalScheduler) {
      await this.externalScheduler.cancel(id);
    }
    return cancelled;
  }

  get(id: string): KnowledgeSynchronizationScheduleEntry | undefined {
    return this.entriesById.get(id);
  }

  require(id: string): KnowledgeSynchronizationScheduleEntry {
    const entry = this.entriesById.get(id);
    if (!entry) {
      throw new ScheduleNotFoundException(`No Schedule entry "${id}" is registered`);
    }
    return entry;
  }

  list(jobId?: string): readonly KnowledgeSynchronizationScheduleEntry[] {
    const all = Array.from(this.entriesById.values());
    return jobId === undefined ? all : all.filter((entry) => entry.jobId === jobId);
  }
}
