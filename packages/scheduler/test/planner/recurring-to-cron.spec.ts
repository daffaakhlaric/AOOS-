import { describe, expect, it } from "vitest";

import type { RecurringSchedule } from "../../src/contracts/recurring-schedule.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { recurringToCron } from "../../src/planner/recurring-to-cron.js";

function schedule(overrides: Partial<RecurringSchedule> = {}): RecurringSchedule {
  return {
    type: ScheduleType.RECURRING,
    timezone: "UTC",
    frequency: "daily",
    time: "09:00",
    ...overrides,
  };
}

describe("recurringToCron", () => {
  it("daily: dom and dow are both wildcard", () => {
    const cron = recurringToCron(schedule({ frequency: "daily" }));
    expect(cron.minutes).toEqual(new Set([0]));
    expect(cron.hours).toEqual(new Set([9]));
    expect(cron.domIsWildcard).toBe(true);
    expect(cron.dowIsWildcard).toBe(true);
  });

  it("weekly: dow is restricted to daysOfWeek, dom is wildcard", () => {
    const cron = recurringToCron(schedule({ frequency: "weekly", daysOfWeek: [1, 3, 5] }));
    expect(cron.daysOfWeek).toEqual(new Set([1, 3, 5]));
    expect(cron.domIsWildcard).toBe(true);
    expect(cron.dowIsWildcard).toBe(false);
  });

  it("weekly with no daysOfWeek set results in an empty set (never matches)", () => {
    const cron = recurringToCron(schedule({ frequency: "weekly" }));
    expect(cron.daysOfWeek.size).toBe(0);
  });

  it("monthly: dom is restricted to dayOfMonth, dow is wildcard", () => {
    const cron = recurringToCron(schedule({ frequency: "monthly", dayOfMonth: 15 }));
    expect(cron.daysOfMonth).toEqual(new Set([15]));
    expect(cron.dowIsWildcard).toBe(true);
    expect(cron.domIsWildcard).toBe(false);
  });
});
