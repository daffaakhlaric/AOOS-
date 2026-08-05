export interface LocalFields {
  readonly year: number;
  readonly minute: number;
  readonly hour: number;
  readonly day: number;
  readonly month: number;
  /** 0 (Sunday) through 6 (Saturday), matching Cron's day-of-week convention. */
  readonly weekday: number;
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// `nextCronFireTime` calls this once per candidate minute in its search loop (potentially
// tens of thousands of times) — reusing one formatter per timezone instead of constructing
// a new one every call is the difference between milliseconds and seconds.
const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = FORMATTER_CACHE.get(timezone);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  FORMATTER_CACHE.set(timezone, formatter);
  return formatter;
}

/** Reads the wall-clock calendar fields a UTC instant represents in `timezone` — DST-ready by construction, since `Intl` already accounts for it. */
export function getLocalFields(date: Date, timezone: string): LocalFields {
  const parts = getFormatter(timezone).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  const rawHour = Number(byType.get("hour"));
  return {
    year: Number(byType.get("year")),
    minute: Number(byType.get("minute")),
    // Some locales render midnight as "24" under hour12:false — normalize to 0.
    hour: rawHour === 24 ? 0 : rawHour,
    day: Number(byType.get("day")),
    month: Number(byType.get("month")),
    weekday: WEEKDAY_INDEX[byType.get("weekday") ?? ""] ?? 0,
  };
}
