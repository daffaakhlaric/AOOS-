import { describe, expect, it } from "vitest";

import type { StoredCalendarEvent } from "../domain/calendar-event.js";

import {
  CreateCalendarEventBodySchema,
  GetCalendarQuerySchema,
  UpdateCalendarEventBodySchema,
  toCalendarEventResponseDto,
} from "./calendar-event.dto.js";

describe("GetCalendarQuerySchema", () => {
  it("accepts range=this_week", () => {
    expect(GetCalendarQuerySchema.safeParse({ range: "this_week" }).success).toBe(true);
  });

  it("accepts month=YYYY-MM", () => {
    expect(GetCalendarQuerySchema.safeParse({ month: "2026-08" }).success).toBe(true);
  });

  it("rejects a malformed month", () => {
    expect(GetCalendarQuerySchema.safeParse({ month: "2026-8" }).success).toBe(false);
  });

  it("rejects neither range nor month", () => {
    expect(GetCalendarQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("CreateCalendarEventBodySchema", () => {
  const base = {
    eventType: "SCRAPER_RUN",
    title: "Scrape Foto Mobix",
    scheduledAt: "2026-08-19T06:00:00+07:00",
    recurrence: "ONCE",
  };

  it("accepts a minimal valid ONCE body", () => {
    expect(CreateCalendarEventBodySchema.safeParse(base).success).toBe(true);
  });

  it("rejects one of the 9 unsupported event types", () => {
    const result = CreateCalendarEventBodySchema.safeParse({
      ...base,
      eventType: "CAMPAIGN_CREATE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects VERDICT_EXECUTE (excluded campaign-mutating type)", () => {
    expect(
      CreateCalendarEventBodySchema.safeParse({ ...base, eventType: "VERDICT_EXECUTE" }).success,
    ).toBe(false);
  });

  it("requires recurrenceDays when recurrence is WEEKLY", () => {
    const result = CreateCalendarEventBodySchema.safeParse({
      ...base,
      recurrence: "WEEKLY",
    });
    expect(result.success).toBe(false);
  });

  it("accepts WEEKLY with recurrenceDays", () => {
    const result = CreateCalendarEventBodySchema.safeParse({
      ...base,
      recurrence: "WEEKLY",
      recurrenceDays: [1, 4],
    });
    expect(result.success).toBe(true);
  });

  it("accepts AB_TEST_CHECK", () => {
    expect(
      CreateCalendarEventBodySchema.safeParse({ ...base, eventType: "AB_TEST_CHECK" }).success,
    ).toBe(true);
  });

  it("requires recurrenceIntervalHours when recurrence is INTERVAL_HOURS", () => {
    const result = CreateCalendarEventBodySchema.safeParse({
      ...base,
      eventType: "AB_TEST_CHECK",
      recurrence: "INTERVAL_HOURS",
    });
    expect(result.success).toBe(false);
  });

  it("accepts INTERVAL_HOURS with recurrenceIntervalHours", () => {
    const result = CreateCalendarEventBodySchema.safeParse({
      ...base,
      eventType: "AB_TEST_CHECK",
      recurrence: "INTERVAL_HOURS",
      recurrenceIntervalHours: 6,
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateCalendarEventBodySchema", () => {
  it("accepts an empty patch", () => {
    expect(UpdateCalendarEventBodySchema.safeParse({}).success).toBe(true);
  });

  it("rejects a malformed recurrenceTime", () => {
    expect(UpdateCalendarEventBodySchema.safeParse({ recurrenceTime: "25:00" }).success).toBe(
      false,
    );
  });
});

describe("toCalendarEventResponseDto", () => {
  it("omits undefined optional fields", () => {
    const stored: StoredCalendarEvent = {
      id: "1",
      tenantId: "dss-motor",
      eventType: "SCRAPER_RUN",
      title: "Scrape Foto Mobix",
      scheduledAt: "2026-08-19T06:00:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence: "ONCE",
      status: "PENDING",
      createdBy: "system",
      createdAt: "2026-08-18T00:00:00.000Z",
    };
    const dto = toCalendarEventResponseDto(stored);
    expect(dto).not.toHaveProperty("description");
    expect(dto).not.toHaveProperty("result");
    expect(dto.status).toBe("PENDING");
  });
});
