import type { IClockProvider } from "../clock/i-clock-provider.js";
import { JobState } from "../contracts/job-state.js";
import type { IScheduleStore } from "../store-interface/i-schedule-store.js";

import type { ITimer, TimerTickResult } from "./i-timer.js";

/**
 * Timer (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "TIMER"): the clock-driven tick loop
 * that promotes every due `Waiting` Job to `Ready`. There is no internal `setInterval` —
 * `tick()` is called explicitly (by `scheduler/scheduler.ts`, or a host's own interval),
 * matching the same "no hidden background loop" discipline `@aos/event-bus` uses for
 * dispatch.
 */
export class TimerService implements ITimer {
  constructor(
    private readonly clock: IClockProvider,
    private readonly store: IScheduleStore,
  ) {}

  async tick(): Promise<TimerTickResult> {
    const tickedAt = this.clock.now();
    const due = await this.store.listDue(tickedAt);
    const readyJobIds: string[] = [];
    for (const job of due) {
      await this.store.update(job.jobId, {
        state: JobState.READY,
        updatedAt: tickedAt.toISOString(),
        changelog: [...job.changelog, JobState.READY],
      });
      readyJobIds.push(job.jobId);
    }
    return { readyJobIds, tickedAt };
  }
}
