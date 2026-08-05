import { describe, expect, it } from "vitest";

import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { scheduleSchema } from "../../src/contracts/schedule.js";

describe("Schema Test — scheduleSchema (Supported Schedule kinds)", () => {
  it("accepts a One Time schedule", () => {
    expect(
      scheduleSchema.safeParse({ type: ScheduleType.ONE_TIME, fireAt: "2026-01-01T00:00:00.000Z" })
        .success,
    ).toBe(true);
  });

  it("accepts a Recurring schedule", () => {
    expect(
      scheduleSchema.safeParse({
        type: ScheduleType.RECURRING,
        frequency: "daily",
        time: "09:00",
      }).success,
    ).toBe(true);
  });

  it("rejects a Recurring schedule with a malformed time", () => {
    expect(
      scheduleSchema.safeParse({ type: ScheduleType.RECURRING, frequency: "daily", time: "9am" })
        .success,
    ).toBe(false);
  });

  it("accepts an Interval schedule", () => {
    expect(scheduleSchema.safeParse({ type: ScheduleType.INTERVAL, everyMs: 60_000 }).success).toBe(
      true,
    );
  });

  it("rejects an Interval schedule with a non-positive everyMs", () => {
    expect(scheduleSchema.safeParse({ type: ScheduleType.INTERVAL, everyMs: 0 }).success).toBe(
      false,
    );
  });

  it("accepts a Cron schedule", () => {
    expect(
      scheduleSchema.safeParse({ type: ScheduleType.CRON, expression: "0 9 * * *" }).success,
    ).toBe(true);
  });

  it("accepts a Calendar schedule", () => {
    expect(
      scheduleSchema.safeParse({
        type: ScheduleType.CALENDAR,
        dates: ["2026-03-31T00:00:00.000Z"],
      }).success,
    ).toBe(true);
  });

  it("rejects a Calendar schedule with an empty dates array", () => {
    expect(scheduleSchema.safeParse({ type: ScheduleType.CALENDAR, dates: [] }).success).toBe(
      false,
    );
  });

  it("accepts a Delayed schedule", () => {
    expect(scheduleSchema.safeParse({ type: ScheduleType.DELAYED, delayMs: 5000 }).success).toBe(
      true,
    );
  });

  it("accepts a Dependency schedule", () => {
    expect(
      scheduleSchema.safeParse({ type: ScheduleType.DEPENDENCY, dependsOnJobIds: ["job-1"] })
        .success,
    ).toBe(true);
  });

  it("rejects a Dependency schedule with no dependencies", () => {
    expect(
      scheduleSchema.safeParse({ type: ScheduleType.DEPENDENCY, dependsOnJobIds: [] }).success,
    ).toBe(false);
  });

  it("accepts a Manual schedule", () => {
    expect(scheduleSchema.safeParse({ type: ScheduleType.MANUAL }).success).toBe(true);
  });

  it("rejects an unknown schedule type", () => {
    expect(scheduleSchema.safeParse({ type: "bogus" }).success).toBe(false);
  });

  it("defaults timezone to UTC when omitted", () => {
    const result = scheduleSchema.safeParse({ type: ScheduleType.MANUAL });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("UTC");
    }
  });
});
