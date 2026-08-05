import { describe, expect, it } from "vitest";

import { CronParseException } from "../../src/errors/cron-parse-exception.js";
import { parseCronExpression } from "../../src/planner/cron-parser.js";

describe("Cron Parser Test — parseCronExpression", () => {
  it("parses a fully-wildcard expression", () => {
    const cron = parseCronExpression("* * * * *");
    expect(cron.minutes.size).toBe(60);
    expect(cron.hours.size).toBe(24);
    expect(cron.daysOfMonth.size).toBe(31);
    expect(cron.months.size).toBe(12);
    expect(cron.daysOfWeek.size).toBe(7);
    expect(cron.domIsWildcard).toBe(true);
    expect(cron.dowIsWildcard).toBe(true);
  });

  it("parses exact single values", () => {
    const cron = parseCronExpression("30 9 15 6 3");
    expect(cron.minutes).toEqual(new Set([30]));
    expect(cron.hours).toEqual(new Set([9]));
    expect(cron.daysOfMonth).toEqual(new Set([15]));
    expect(cron.months).toEqual(new Set([6]));
    expect(cron.daysOfWeek).toEqual(new Set([3]));
    expect(cron.domIsWildcard).toBe(false);
    expect(cron.dowIsWildcard).toBe(false);
  });

  it("parses a range", () => {
    const cron = parseCronExpression("0 9-17 * * *");
    expect(cron.hours).toEqual(new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]));
  });

  it("parses a step over the full range", () => {
    const cron = parseCronExpression("*/15 * * * *");
    expect(cron.minutes).toEqual(new Set([0, 15, 30, 45]));
  });

  it("parses a step over an explicit range", () => {
    const cron = parseCronExpression("0 8-18/2 * * *");
    expect(cron.hours).toEqual(new Set([8, 10, 12, 14, 16, 18]));
  });

  it("parses a comma-separated list", () => {
    const cron = parseCronExpression("0,15,30,45 * * * *");
    expect(cron.minutes).toEqual(new Set([0, 15, 30, 45]));
  });

  it("parses a list mixing ranges and single values", () => {
    const cron = parseCronExpression("0 0 * * 1-3,5");
    expect(cron.daysOfWeek).toEqual(new Set([1, 2, 3, 5]));
  });

  it("throws CronParseException for the wrong number of fields", () => {
    expect(() => parseCronExpression("* * * *")).toThrow(CronParseException);
    expect(() => parseCronExpression("* * * * * *")).toThrow(CronParseException);
  });

  it("throws CronParseException for an out-of-range value", () => {
    expect(() => parseCronExpression("60 * * * *")).toThrow(CronParseException);
    expect(() => parseCronExpression("* 24 * * *")).toThrow(CronParseException);
  });

  it("throws CronParseException for an invalid range (start > end)", () => {
    expect(() => parseCronExpression("0 17-9 * * *")).toThrow(CronParseException);
  });

  it("throws CronParseException for a non-numeric value", () => {
    expect(() => parseCronExpression("abc * * * *")).toThrow(CronParseException);
  });

  it("throws CronParseException for an invalid step", () => {
    expect(() => parseCronExpression("*/0 * * * *")).toThrow(CronParseException);
    expect(() => parseCronExpression("*/abc * * * *")).toThrow(CronParseException);
  });
});
