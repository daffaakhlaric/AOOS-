import { describe, expect, it } from "vitest";

import { ObjectivePeriod } from "../../../src/domain/value-objects/ObjectivePeriod.js";
import { daysElapsedInPeriod, daysRemainingInPeriod } from "../../../src/utils/PeriodUtils.js";
import { unwrap } from "../../helpers/result.js";

describe("daysElapsedInPeriod / daysRemainingInPeriod", () => {
  it("computes days elapsed/remaining mid-month for a 31-day month (August)", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const now = new Date(2026, 7, 9); // Aug 9, 2026 local
    expect(daysElapsedInPeriod(period, now)).toBe(9);
    expect(daysRemainingInPeriod(period, now)).toBe(31 - 9);
  });

  it("day 1 of the month -> daysElapsed=1 (inclusive of current day)", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const now = new Date(2026, 7, 1);
    expect(daysElapsedInPeriod(period, now)).toBe(1);
    expect(daysRemainingInPeriod(period, now)).toBe(30);
  });

  it("last day of a 31-day month -> daysElapsed=31, daysRemaining=0", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const now = new Date(2026, 7, 31);
    expect(daysElapsedInPeriod(period, now)).toBe(31);
    expect(daysRemainingInPeriod(period, now)).toBe(0);
  });

  it("handles February in a non-leap year (2026, 28 days)", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 2, year: 2026 }));
    const now = new Date(2026, 1, 28);
    expect(daysElapsedInPeriod(period, now)).toBe(28);
    expect(daysRemainingInPeriod(period, now)).toBe(0);
  });

  it("handles February in a leap year (2028, 29 days)", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 2, year: 2028 }));
    const now = new Date(2028, 1, 29);
    expect(daysElapsedInPeriod(period, now)).toBe(29);
    expect(daysRemainingInPeriod(period, now)).toBe(0);
  });

  it("handles a 30-day month (September)", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 9, year: 2026 }));
    const now = new Date(2026, 8, 15);
    expect(daysElapsedInPeriod(period, now)).toBe(15);
    expect(daysRemainingInPeriod(period, now)).toBe(15);
  });

  it("clamps to 0 when now is before the period start", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const now = new Date(2026, 6, 31); // July 31
    expect(daysElapsedInPeriod(period, now)).toBe(0);
    expect(daysRemainingInPeriod(period, now)).toBe(31);
  });

  it("clamps to the full month length when now is after the period end", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const now = new Date(2026, 8, 15); // September 15
    expect(daysElapsedInPeriod(period, now)).toBe(31);
    expect(daysRemainingInPeriod(period, now)).toBe(0);
  });

  it("is time-of-day independent (only calendar date matters)", () => {
    const period = unwrap(ObjectivePeriod.create({ month: 8, year: 2026 }));
    const morning = new Date(2026, 7, 9, 1, 0, 0);
    const evening = new Date(2026, 7, 9, 23, 59, 59);
    expect(daysElapsedInPeriod(period, morning)).toBe(daysElapsedInPeriod(period, evening));
  });
});
