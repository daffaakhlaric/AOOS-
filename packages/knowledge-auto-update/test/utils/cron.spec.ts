import { describe, expect, it } from "vitest";

import { InvalidCronExpressionException } from "../../src/errors/invalid-cron-expression-exception.js";
import {
  computeNextCronFireTime,
  computeNextCronFireTimeAtOrAfter,
  parseCronExpression,
} from "../../src/utils/cron.js";

function utc(y: number, m: number, d: number, h = 0, min = 0): number {
  return Date.UTC(y, m - 1, d, h, min, 0, 0);
}

describe("parseCronExpression", () => {
  it("parses a wildcard-only expression", () => {
    const parsed = parseCronExpression("* * * * *");
    expect(parsed.minute.size).toBe(60);
    expect(parsed.hour.size).toBe(24);
    expect(parsed.dayOfMonth.size).toBe(31);
    expect(parsed.month.size).toBe(12);
    expect(parsed.dayOfWeek.size).toBe(7);
    expect(parsed.dayOfMonthRestricted).toBe(false);
    expect(parsed.dayOfWeekRestricted).toBe(false);
  });

  it("parses a single numeric field", () => {
    const parsed = parseCronExpression("30 9 * * *");
    expect([...parsed.minute]).toEqual([30]);
    expect([...parsed.hour]).toEqual([9]);
  });

  it("parses a list field", () => {
    const parsed = parseCronExpression("5,10,15 * * * *");
    expect([...parsed.minute].sort((a, b) => a - b)).toEqual([5, 10, 15]);
  });

  it("parses a range field", () => {
    const parsed = parseCronExpression("10-12 * * * *");
    expect([...parsed.minute].sort((a, b) => a - b)).toEqual([10, 11, 12]);
  });

  it("parses a step field over the full wildcard range", () => {
    const parsed = parseCronExpression("*/15 * * * *");
    expect([...parsed.minute].sort((a, b) => a - b)).toEqual([0, 15, 30, 45]);
  });

  it("parses a step field over a sub-range", () => {
    const parsed = parseCronExpression("10-20/5 * * * *");
    expect([...parsed.minute].sort((a, b) => a - b)).toEqual([10, 15, 20]);
  });

  it("marks day-of-month restricted when not '*'", () => {
    const parsed = parseCronExpression("0 0 1 * *");
    expect(parsed.dayOfMonthRestricted).toBe(true);
    expect(parsed.dayOfWeekRestricted).toBe(false);
  });

  it("marks day-of-week restricted when not '*'", () => {
    const parsed = parseCronExpression("0 0 * * 1");
    expect(parsed.dayOfWeekRestricted).toBe(true);
    expect(parsed.dayOfMonthRestricted).toBe(false);
  });

  it("throws on wrong field count", () => {
    expect(() => parseCronExpression("* * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on empty field segment", () => {
    expect(() => parseCronExpression(", * * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on invalid step syntax", () => {
    expect(() => parseCronExpression("*/ * * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on non-integer step value", () => {
    expect(() => parseCronExpression("*/abc * * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on zero step value", () => {
    expect(() => parseCronExpression("*/0 * * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on invalid range (low > high)", () => {
    expect(() => parseCronExpression("30-10 * * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on non-numeric single value", () => {
    expect(() => parseCronExpression("abc * * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on out-of-range minute value", () => {
    expect(() => parseCronExpression("60 * * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on out-of-range hour value", () => {
    expect(() => parseCronExpression("0 24 * * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on out-of-range day-of-month value", () => {
    expect(() => parseCronExpression("0 0 32 * *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on out-of-range month value", () => {
    expect(() => parseCronExpression("0 0 * 13 *")).toThrow(InvalidCronExpressionException);
  });

  it("throws on out-of-range day-of-week value", () => {
    expect(() => parseCronExpression("0 0 * * 7")).toThrow(InvalidCronExpressionException);
  });

  it("throws on malformed range with too many parts", () => {
    expect(() => parseCronExpression("1-2-3 * * * *")).toThrow(InvalidCronExpressionException);
  });
});

describe("computeNextCronFireTime", () => {
  it("finds the next minute for '* * * * *'", () => {
    const from = utc(2026, 1, 1, 10, 0);
    expect(computeNextCronFireTime("* * * * *", from)).toBe(utc(2026, 1, 1, 10, 1));
  });

  it("finds the top of the next hour for '0 * * * *'", () => {
    const from = utc(2026, 1, 1, 10, 15);
    expect(computeNextCronFireTime("0 * * * *", from)).toBe(utc(2026, 1, 1, 11, 0));
  });

  it("finds daily 09:30 the same day if not yet passed", () => {
    const from = utc(2026, 1, 1, 8, 0);
    expect(computeNextCronFireTime("30 9 * * *", from)).toBe(utc(2026, 1, 1, 9, 30));
  });

  it("finds daily 09:30 the next day if already passed", () => {
    const from = utc(2026, 1, 1, 10, 0);
    expect(computeNextCronFireTime("30 9 * * *", from)).toBe(utc(2026, 1, 2, 9, 30));
  });

  it("finds the first day of the next month at midnight", () => {
    const from = utc(2026, 1, 15, 0, 0);
    expect(computeNextCronFireTime("0 0 1 * *", from)).toBe(utc(2026, 2, 1, 0, 0));
  });

  it("finds the next Sunday midnight for day-of-week 0", () => {
    // 2026-01-01 is a Thursday (day 4). Next Sunday is 2026-01-04.
    const from = utc(2026, 1, 1, 0, 0);
    const next = computeNextCronFireTime("0 0 * * 0", from);
    expect(new Date(next).getUTCDay()).toBe(0);
    expect(next).toBe(utc(2026, 1, 4, 0, 0));
  });

  it("respects step values for quarter-hour scheduling", () => {
    const from = utc(2026, 1, 1, 10, 1);
    expect(computeNextCronFireTime("*/15 * * * *", from)).toBe(utc(2026, 1, 1, 10, 15));
  });

  it("applies OR semantics when both day-of-month and day-of-week are restricted", () => {
    // Fires on the 1st of the month OR every Monday.
    // 2026-01-01 is a Thursday; next Monday after 2026-01-01 10:00 is 2026-01-05.
    const from = utc(2026, 1, 1, 10, 0);
    const next = computeNextCronFireTime("0 0 1 * 1", from);
    expect(next).toBe(utc(2026, 1, 5, 0, 0));
  });

  it("applies AND-like single-field restriction when only day-of-month restricted", () => {
    const from = utc(2026, 1, 1, 0, 0);
    const next = computeNextCronFireTime("0 0 15 * *", from);
    expect(next).toBe(utc(2026, 1, 15, 0, 0));
  });

  it("throws when no match is found within the search bound", () => {
    // Feb 30th never exists, so day-of-month 30 combined with month 2 never matches.
    expect(() => computeNextCronFireTime("0 0 30 2 *", utc(2026, 1, 1, 0, 0))).toThrow(
      InvalidCronExpressionException,
    );
  });
});

describe("computeNextCronFireTime — parameterized correctness table", () => {
  const cases: Array<
    [string, [number, number, number, number, number], [number, number, number, number, number]]
  > = [
    ["*/10 * * * *", [2026, 1, 1, 10, 5], [2026, 1, 1, 10, 10]],
    ["*/10 * * * *", [2026, 1, 1, 10, 55], [2026, 1, 1, 11, 0]],
    ["0,30 * * * *", [2026, 1, 1, 10, 0], [2026, 1, 1, 10, 30]],
    ["0,30 * * * *", [2026, 1, 1, 10, 30], [2026, 1, 1, 11, 0]],
    ["15 8 * * *", [2026, 1, 1, 8, 14], [2026, 1, 1, 8, 15]],
    ["0 0 1 2 *", [2026, 1, 1, 0, 1], [2026, 2, 1, 0, 0]],
    ["0 12 * * *", [2026, 6, 15, 11, 59], [2026, 6, 15, 12, 0]],
    ["0 0 * * 6", [2026, 1, 1, 0, 0], [2026, 1, 3, 0, 0]], // Sat after Thu 2026-01-01
  ];

  it.each(cases)("expression %s from %j fires at %j", (expression, from, expected) => {
    const fromMs = utc(...from);
    const expectedMs = utc(...expected);
    expect(computeNextCronFireTime(expression, fromMs)).toBe(expectedMs);
  });
});

describe("computeNextCronFireTimeAtOrAfter", () => {
  it("returns the same minute when it already matches", () => {
    const from = utc(2026, 1, 1, 9, 30);
    expect(computeNextCronFireTimeAtOrAfter("30 9 * * *", from)).toBe(from);
  });

  it("returns the next occurrence when the current minute does not match", () => {
    const from = utc(2026, 1, 1, 9, 29);
    expect(computeNextCronFireTimeAtOrAfter("30 9 * * *", from)).toBe(utc(2026, 1, 1, 9, 30));
  });

  it("rounds down seconds/millis within the matching minute", () => {
    const from = utc(2026, 1, 1, 9, 30) + 45_000;
    expect(computeNextCronFireTimeAtOrAfter("30 9 * * *", from)).toBe(utc(2026, 1, 1, 9, 30));
  });
});
