import { InvalidScheduleException } from "../errors/invalid-schedule-exception.js";
import { JobNotFoundException } from "../errors/job-not-found-exception.js";
import { ScheduleKind, type ScheduleDescriptor } from "../types/schedule-descriptor.js";
import { computeNextCronFireTime, computeNextCronFireTimeAtOrAfter } from "../utils/cron.js";
import { priorityTopologicalSort, type DependencyEdge } from "../utils/topological-sort.js";

interface ScheduleEntry {
  readonly jobId: string;
  schedule: ScheduleDescriptor;
  priority: number;
  dependsOn: readonly string[];
  nextRunAt: number;
  paused: boolean;
}

/** Computes the first run time for a freshly-registered schedule, given "now". */
export function computeInitialRunAt(schedule: ScheduleDescriptor, now: number): number {
  switch (schedule.kind) {
    case ScheduleKind.Immediate:
      return now;
    case ScheduleKind.Scheduled:
      return schedule.runAt;
    case ScheduleKind.Interval:
      return schedule.startAt >= now ? schedule.startAt : now;
    case ScheduleKind.Cron:
      return computeNextCronFireTimeAtOrAfter(schedule.expression, now);
  }
}

/** Computes the NEXT run time for a repeating schedule after it has just fired at `firedAt`. */
export function computeNextRunAt(
  schedule: ScheduleDescriptor,
  firedAt: number,
): number | undefined {
  switch (schedule.kind) {
    case ScheduleKind.Immediate:
    case ScheduleKind.Scheduled:
      return undefined; // one-shot
    case ScheduleKind.Interval:
      return firedAt + schedule.intervalMs;
    case ScheduleKind.Cron:
      return computeNextCronFireTime(schedule.expression, firedAt);
  }
}

/**
 * Owns all scheduling state: a priority-queue-and-cron-model registry of `ScheduleEntry` per job,
 * pause/resume/cancel, and the single `processDue(now)` entry point that combines dependency-aware
 * ordering with priority-queue ordering (via `priorityTopologicalSort`). No real timers are ever
 * registered — callers (or tests) drive time explicitly by invoking `processDue(now)`.
 */
export class KnowledgeUpdateScheduler {
  private readonly entries = new Map<string, ScheduleEntry>();
  private readonly registrationOrder: string[] = [];

  register(
    jobId: string,
    schedule: ScheduleDescriptor,
    priority: number,
    dependsOn: readonly string[],
    now: number,
  ): number {
    if (schedule.kind === ScheduleKind.Interval && schedule.intervalMs <= 0) {
      throw new InvalidScheduleException("interval schedule intervalMs must be > 0", { jobId });
    }
    const nextRunAt = computeInitialRunAt(schedule, now);
    this.entries.set(jobId, { jobId, schedule, priority, dependsOn, nextRunAt, paused: false });
    if (!this.registrationOrder.includes(jobId)) this.registrationOrder.push(jobId);
    return nextRunAt;
  }

  reschedule(jobId: string, nextRunAt: number): void {
    const entry = this.getEntry(jobId);
    entry.nextRunAt = nextRunAt;
  }

  updatePriority(jobId: string, priority: number): void {
    this.getEntry(jobId).priority = priority;
  }

  pause(jobId: string): void {
    this.getEntry(jobId).paused = true;
  }

  resume(jobId: string): void {
    this.getEntry(jobId).paused = false;
  }

  cancel(jobId: string): void {
    if (!this.entries.has(jobId)) throw new JobNotFoundException(jobId);
    this.entries.delete(jobId);
    const idx = this.registrationOrder.indexOf(jobId);
    if (idx >= 0) this.registrationOrder.splice(idx, 1);
  }

  isPaused(jobId: string): boolean {
    return this.getEntry(jobId).paused;
  }

  isScheduled(jobId: string): boolean {
    return this.entries.has(jobId);
  }

  getNextRunAt(jobId: string): number {
    return this.getEntry(jobId).nextRunAt;
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns job ids that are due at `now` (not paused, `nextRunAt <= now`), ordered by combined
   * dependency + priority rules. Repeating schedules (Interval/Cron) are automatically
   * rescheduled to their next occurrence; one-shot schedules (Immediate/Scheduled) are removed
   * from the queue once dispatched.
   */
  processDue(now: number): string[] {
    const dueIds = [...this.entries.values()]
      .filter((entry) => !entry.paused && entry.nextRunAt <= now)
      .map((entry) => entry.jobId);

    if (dueIds.length === 0) return [];

    const dueSet = new Set(dueIds);
    const edges: DependencyEdge[] = [];
    for (const jobId of dueIds) {
      const entry = this.getEntry(jobId);
      for (const dep of entry.dependsOn) {
        if (dueSet.has(dep)) edges.push({ from: dep, to: jobId });
      }
    }

    const ordered = priorityTopologicalSort(dueIds, edges, (id) => this.getEntry(id).priority);

    for (const jobId of ordered) {
      const entry = this.getEntry(jobId);
      const next = computeNextRunAt(entry.schedule, now);
      if (next === undefined) {
        this.entries.delete(jobId);
        const idx = this.registrationOrder.indexOf(jobId);
        if (idx >= 0) this.registrationOrder.splice(idx, 1);
      } else {
        entry.nextRunAt = next;
      }
    }

    return ordered;
  }

  private getEntry(jobId: string): ScheduleEntry {
    const entry = this.entries.get(jobId);
    if (!entry) throw new JobNotFoundException(jobId);
    return entry;
  }
}
