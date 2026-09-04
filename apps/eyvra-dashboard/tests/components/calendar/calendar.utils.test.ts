import { describe, expect, it } from "vitest";

import {
  formatEventTime,
  formatFullDayId,
  formatShortDayId,
  formatWeekdayShort,
  groupCalendarEvents,
} from "@/components/calendar/calendar.utils";
import type { CalendarEventDto } from "@/types/dashboard.types";

function event(overrides: Partial<CalendarEventDto> = {}): CalendarEventDto {
  return {
    id: "evt-1",
    eventType: "SCRAPER_RUN",
    title: "Scrape Foto Mobix",
    scheduledAt: "2026-08-18T23:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: "ONCE",
    status: "PENDING",
    createdBy: "system",
    createdAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatEventTime", () => {
  it("renders the WIB (UTC+7) time, not the raw UTC time", () => {
    // 2026-08-18T23:00:00Z -> 2026-08-19 06:00 WIB.
    expect(formatEventTime("2026-08-18T23:00:00.000Z")).toBe("06:00");
  });
});

describe("formatFullDayId / formatShortDayId", () => {
  it("format a real Indonesian weekday + date, in Asia/Jakarta", () => {
    const date = new Date("2026-08-18T23:00:00.000Z"); // 2026-08-19 WIB, a Wednesday.
    expect(formatFullDayId(date)).toContain("Rabu");
    expect(formatFullDayId(date)).toContain("2026");
    expect(formatShortDayId(date)).toContain("Rabu");
  });
});

describe("formatWeekdayShort", () => {
  it("renders a compact 'Sen 18' style label", () => {
    // 2026-08-17T23:00:00Z -> 2026-08-18 WIB, a Tuesday.
    const label = formatWeekdayShort("2026-08-17T23:00:00.000Z");
    expect(label).toMatch(/^Sel\.? 18$/);
  });
});

describe("groupCalendarEvents", () => {
  it("splits events into today/tomorrow/restOfWeek by Asia/Jakarta calendar day", () => {
    const now = new Date("2026-08-18T02:00:00.000Z"); // 2026-08-18 09:00 WIB.
    const events: CalendarEventDto[] = [
      event({ id: "today", scheduledAt: "2026-08-18T23:00:00.000Z" }), // 08-19 WIB -> actually next day
      event({ id: "today-2", scheduledAt: "2026-08-17T23:30:00.000Z" }), // 08-18 06:30 WIB -> today
      event({ id: "tomorrow", scheduledAt: "2026-08-18T23:30:00.000Z" }), // 08-19 06:30 WIB -> tomorrow
      event({ id: "rest", scheduledAt: "2026-08-20T23:30:00.000Z" }), // 08-21 WIB -> rest of week
      event({ id: "past", scheduledAt: "2026-08-10T00:00:00.000Z" }), // before today -> dropped
    ];

    const grouped = groupCalendarEvents(events, now);
    expect(grouped.today.map((e) => e.id)).toEqual(["today-2"]);
    expect(grouped.tomorrow.map((e) => e.id).sort()).toEqual(["today", "tomorrow"].sort());
    expect(grouped.restOfWeek.map((e) => e.id)).toEqual(["rest"]);
  });

  it("sorts each bucket by scheduledAt ascending", () => {
    const now = new Date("2026-08-18T02:00:00.000Z");
    const events: CalendarEventDto[] = [
      event({ id: "late", scheduledAt: "2026-08-17T23:00:00.000Z" }),
      event({ id: "early", scheduledAt: "2026-08-17T22:00:00.000Z" }),
    ];
    const grouped = groupCalendarEvents(events, now);
    expect(grouped.today.map((e) => e.id)).toEqual(["early", "late"]);
  });
});
