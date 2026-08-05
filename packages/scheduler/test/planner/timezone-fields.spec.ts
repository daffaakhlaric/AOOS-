import { describe, expect, it } from "vitest";

import { getLocalFields } from "../../src/planner/timezone-fields.js";

describe("Timezone Test — getLocalFields", () => {
  it("reads UTC fields directly", () => {
    const fields = getLocalFields(new Date("2026-03-15T14:30:00.000Z"), "UTC");
    expect(fields).toEqual({ year: 2026, minute: 30, hour: 14, day: 15, month: 3, weekday: 0 });
  });

  it("converts to a positive-offset timezone (Asia/Jakarta, UTC+7, no DST)", () => {
    const fields = getLocalFields(new Date("2026-03-15T20:00:00.000Z"), "Asia/Jakarta");
    expect(fields.hour).toBe(3);
    expect(fields.day).toBe(16);
  });

  it("converts to a negative-offset timezone (America/New_York)", () => {
    // 2026-03-15 is before US DST starts (second Sunday of March, i.e. March 8 2026) — EST (UTC-5).
    const fields = getLocalFields(new Date("2026-03-01T04:00:00.000Z"), "America/New_York");
    expect(fields.hour).toBe(23);
    expect(fields.day).toBe(28);
    expect(fields.month).toBe(2);
  });

  it("is DST-ready — the same wall-clock offset differs across a DST boundary", () => {
    // America/New_York: EST (UTC-5) before March 8 2026, EDT (UTC-4) after.
    const beforeDst = getLocalFields(new Date("2026-03-01T12:00:00.000Z"), "America/New_York");
    const afterDst = getLocalFields(new Date("2026-03-15T12:00:00.000Z"), "America/New_York");
    expect(beforeDst.hour).toBe(7);
    expect(afterDst.hour).toBe(8);
  });

  it("computes the correct weekday (0=Sunday .. 6=Saturday)", () => {
    // 2026-01-01 is a Thursday.
    expect(getLocalFields(new Date("2026-01-01T12:00:00.000Z"), "UTC").weekday).toBe(4);
  });
});
