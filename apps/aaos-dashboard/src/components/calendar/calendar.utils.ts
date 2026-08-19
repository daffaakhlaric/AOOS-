import type { CalendarEventDto } from "@/types/dashboard.types";

const JAKARTA_TZ = "Asia/Jakarta";

/** "06:00" — the event's `scheduledAt` rendered in Asia/Jakarta (WIB), matching every other WIB-facing display in this app. */
export function formatEventTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: JAKARTA_TZ,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

/** "Selasa, 16 Agu 2026" — for the "HARI INI —" section label. */
export function formatFullDayId(date: Date): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: JAKARTA_TZ,
  }).format(date);
  return formatted;
}

/** "Rabu, 17 Agu" — for the "BESOK —" section label (no year, matches spec mockup). */
export function formatShortDayId(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: JAKARTA_TZ,
  }).format(date);
}

/** "Sen 18" — the compact per-row day label used in "MINGGU INI". */
export function formatWeekdayShort(iso: string): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    timeZone: JAKARTA_TZ,
  }).formatToParts(new Date(iso));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  // Indonesian short weekday from Intl is already 3 letters + "." (e.g. "Sen.") in some engines —
  // normalize to bare "Sen" to match the spec's compact mockup exactly.
  return `${weekday.replace(".", "")} ${day}`;
}

/** `YYYY-MM-DD` in Asia/Jakarta — the calendar-day key used to group events into today/tomorrow/rest-of-week. */
function jakartaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JAKARTA_TZ }).format(date);
}

export interface GroupedCalendarEvents {
  readonly today: readonly CalendarEventDto[];
  readonly tomorrow: readonly CalendarEventDto[];
  readonly restOfWeek: readonly CalendarEventDto[];
}

/** Splits a flat (already `range=this_week`-scoped) event list into today / tomorrow / the rest of the week, sorted by `scheduledAt` within each bucket. Grouping is by Asia/Jakarta calendar day, not UTC — a 23:00 UTC event on a WIB evening must not spill into "tomorrow". */
export function groupCalendarEvents(
  events: readonly CalendarEventDto[],
  now: Date,
): GroupedCalendarEvents {
  const todayKey = jakartaDateKey(now);
  const tomorrowKey = jakartaDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const sorted = [...events].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  const today: CalendarEventDto[] = [];
  const tomorrow: CalendarEventDto[] = [];
  const restOfWeek: CalendarEventDto[] = [];

  for (const event of sorted) {
    const key = jakartaDateKey(new Date(event.scheduledAt));
    if (key === todayKey) {
      today.push(event);
    } else if (key === tomorrowKey) {
      tomorrow.push(event);
    } else if (key > todayKey) {
      restOfWeek.push(event);
    }
  }

  return { today, tomorrow, restOfWeek };
}
