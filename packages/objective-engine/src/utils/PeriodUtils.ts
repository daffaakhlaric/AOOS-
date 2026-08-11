import type { ObjectivePeriod } from "../domain/value-objects/ObjectivePeriod.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Whole calendar days elapsed within `period` as of `now` (inclusive of the current day — an
 * Objective created and checked on day 1 of its month has `daysElapsed === 1`, not `0`).
 * Clamped to `[0, daysInMonth()]`: `now` before the period start yields `0`; `now` after the
 * period end yields the full month length.
 */
export function daysElapsedInPeriod(period: ObjectivePeriod, now: Date): number {
  const start = startOfDay(period.startDate());
  const totalDays = period.daysInMonth();
  const today = startOfDay(now);
  if (today.getTime() < start.getTime()) {
    return 0;
  }
  const diffDays = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return Math.min(totalDays, diffDays);
}

/** Whole calendar days remaining in `period` as of `now` — `daysInMonth() - daysElapsedInPeriod()`. */
export function daysRemainingInPeriod(period: ObjectivePeriod, now: Date): number {
  return period.daysInMonth() - daysElapsedInPeriod(period, now);
}
