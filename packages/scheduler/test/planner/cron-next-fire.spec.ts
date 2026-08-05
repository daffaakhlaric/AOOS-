import { describe, expect, it } from "vitest";

import { nextCronFireTime } from "../../src/planner/cron-next-fire.js";
import { parseCronExpression } from "../../src/planner/cron-parser.js";

describe("Cron Parser Test — nextCronFireTime", () => {
  it("finds the next daily-at-09:00 UTC occurrence", () => {
    const cron = parseCronExpression("0 9 * * *");
    const next = nextCronFireTime(cron, new Date("2026-01-01T08:00:00.000Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-01-01T09:00:00.000Z");
  });

  it("rolls over to the next day when already past today's time", () => {
    const cron = parseCronExpression("0 9 * * *");
    const next = nextCronFireTime(cron, new Date("2026-01-01T10:00:00.000Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-01-02T09:00:00.000Z");
  });

  it("is strictly after the reference instant, even exactly on a match", () => {
    const cron = parseCronExpression("0 9 * * *");
    const next = nextCronFireTime(cron, new Date("2026-01-01T09:00:00.000Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-01-02T09:00:00.000Z");
  });

  it("respects a restricted day-of-week (every Monday at 09:00)", () => {
    const cron = parseCronExpression("0 9 * * 1");
    // 2026-01-01 is a Thursday.
    const next = nextCronFireTime(cron, new Date("2026-01-01T00:00:00.000Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });

  it("respects a restricted day-of-month (the 15th at 09:00)", () => {
    const cron = parseCronExpression("0 9 15 * *");
    const next = nextCronFireTime(cron, new Date("2026-01-01T00:00:00.000Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("OR-combines day-of-month and day-of-week when both are restricted", () => {
    // Fires on the 1st of the month OR on a Monday, at 09:00.
    const cron = parseCronExpression("0 9 1 * 1");
    // 2026-01-05 is a Monday, before the 1st of February — the OR rule should match it.
    const next = nextCronFireTime(cron, new Date("2026-01-02T00:00:00.000Z"), "UTC");
    expect(next?.toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });

  it("is timezone-aware (09:00 in a positive-offset timezone is earlier in UTC)", () => {
    const cron = parseCronExpression("0 9 * * *");
    const next = nextCronFireTime(cron, new Date("2026-01-01T00:00:00.000Z"), "Asia/Jakarta");
    // Asia/Jakarta is UTC+7 with no DST.
    expect(next?.toISOString()).toBe("2026-01-01T02:00:00.000Z");
  });

  it("returns undefined when no match exists within maxIterations", () => {
    // Feb 30th never exists — an artificially tiny iteration budget guarantees no match is found in time.
    const cron = parseCronExpression("0 0 30 2 *");
    const next = nextCronFireTime(cron, new Date("2026-01-01T00:00:00.000Z"), "UTC", 10);
    expect(next).toBeUndefined();
  });
});
