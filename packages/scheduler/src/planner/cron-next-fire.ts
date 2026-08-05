import type { ParsedCron } from "./cron-parser.js";
import { getLocalFields } from "./timezone-fields.js";

const MINUTE_MS = 60_000;
/** ~4 years of minutes — a superset of Cron's documented worst case (e.g. a leap-day-only expression). */
const DEFAULT_MAX_ITERATIONS = 4 * 366 * 24 * 60;

/** The next instant strictly after `after` that satisfies every field of `cron`, evaluated in `timezone`. `undefined` if none is found within `maxIterations` minutes. */
export function nextCronFireTime(
  cron: ParsedCron,
  after: Date,
  timezone: string,
  maxIterations = DEFAULT_MAX_ITERATIONS,
): Date | undefined {
  let candidate = new Date(Math.ceil((after.getTime() + 1) / MINUTE_MS) * MINUTE_MS);

  for (let i = 0; i < maxIterations; i += 1) {
    const local = getLocalFields(candidate, timezone);
    const domMatch = cron.daysOfMonth.has(local.day);
    const dowMatch = cron.daysOfWeek.has(local.weekday);
    const dayMatches =
      cron.domIsWildcard && cron.dowIsWildcard
        ? true
        : cron.domIsWildcard
          ? dowMatch
          : cron.dowIsWildcard
            ? domMatch
            : domMatch || dowMatch;

    if (
      cron.minutes.has(local.minute) &&
      cron.hours.has(local.hour) &&
      cron.months.has(local.month) &&
      dayMatches
    ) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + MINUTE_MS);
  }
  return undefined;
}
