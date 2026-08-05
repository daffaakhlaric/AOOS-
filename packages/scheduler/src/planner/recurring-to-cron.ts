import type { RecurringSchedule } from "../contracts/recurring-schedule.js";

import type { ParsedCron } from "./cron-parser.js";

const ALL_MONTHS = new Set(Array.from({ length: 12 }, (_, i) => i + 1));
const ALL_DAYS_OF_MONTH = new Set(Array.from({ length: 31 }, (_, i) => i + 1));
const ALL_DAYS_OF_WEEK = new Set([0, 1, 2, 3, 4, 5, 6]);

/**
 * A Recurring Schedule (`daily`/`weekly`/`monthly` at a fixed `HH:mm`) is exactly equivalent
 * to a restricted Cron Expression — this reuses `cron-next-fire.ts`'s next-fire search
 * instead of a second, parallel time-search implementation.
 */
export function recurringToCron(schedule: RecurringSchedule): ParsedCron {
  const parts = schedule.time.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  const minutes = new Set([minute]);
  const hours = new Set([hour]);

  if (schedule.frequency === "weekly") {
    return {
      minutes,
      hours,
      daysOfMonth: ALL_DAYS_OF_MONTH,
      months: ALL_MONTHS,
      daysOfWeek: new Set(schedule.daysOfWeek ?? []),
      domIsWildcard: true,
      dowIsWildcard: false,
    };
  }
  if (schedule.frequency === "monthly") {
    return {
      minutes,
      hours,
      daysOfMonth: new Set(schedule.dayOfMonth !== undefined ? [schedule.dayOfMonth] : []),
      months: ALL_MONTHS,
      daysOfWeek: ALL_DAYS_OF_WEEK,
      domIsWildcard: false,
      dowIsWildcard: true,
    };
  }
  // "daily"
  return {
    minutes,
    hours,
    daysOfMonth: ALL_DAYS_OF_MONTH,
    months: ALL_MONTHS,
    daysOfWeek: ALL_DAYS_OF_WEEK,
    domIsWildcard: true,
    dowIsWildcard: true,
  };
}
