import type { Schedule } from "../contracts/schedule.js";

export interface PlanningContext {
  /** Never plan an occurrence at or before this instant. */
  readonly after: Date;
  readonly createdAt: Date;
  readonly lastFireAt?: Date;
}

/**
 * Computes the next fire time for a Schedule (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md —
 * "SUPPORTED SCHEDULE"). Returns `undefined` when the schedule has no more occurrences
 * (a one-shot kind that already fired) or has no time component at all (Dependency/Manual —
 * those are driven by `trigger/dependency-trigger.ts` and `trigger/manual-trigger.ts`
 * instead of time).
 */
export interface ISchedulePlanner {
  computeNextFireTime(schedule: Schedule, context: PlanningContext): Date | undefined;
}
