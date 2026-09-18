import { describe, expect, it } from "vitest";

import { computeBudgetPacing, type PacingInput } from "./pacing.js";

const BASE: PacingInput = {
  maxBudgetIdr: 10_000_000,
  startDate: "2026-01-01",
  endDate: "2026-01-11", // inclusive 11-day window
  today: new Date("2026-01-06T00:00:00.000Z"), // 5 days elapsed, 5 remaining (11-day inclusive window)
  actualSpendIdr: 4_500_000,
  spendDataAvailable: true,
};

describe("computeBudgetPacing", () => {
  it("returns UNKNOWN when maxBudgetIdr is undefined", () => {
    const result = computeBudgetPacing({ ...BASE, maxBudgetIdr: undefined });
    expect(result.status).toBe("UNKNOWN");
    expect(result.expectedSpendToDateIdr).toBeUndefined();
    expect(result.pacingPct).toBeUndefined();
    expect(result.requiredDailyPaceIdr).toBeUndefined();
    expect(result.projectedEndOfPeriodSpendIdr).toBeUndefined();
    expect(result.actualSpendIdr).toBe(4_500_000);
  });

  it("returns UNKNOWN when spendDataAvailable is false, even with a real maxBudgetIdr", () => {
    const result = computeBudgetPacing({ ...BASE, spendDataAvailable: false });
    expect(result.status).toBe("UNKNOWN");
    expect(result.expectedSpendToDateIdr).toBeUndefined();
    expect(result.pacingPct).toBeUndefined();
  });

  it("ON_PACE when actual spend is within +/-15% of expected pro-rata spend", () => {
    // totalWindowDays = 11, daysElapsed = 5 -> expected = 10_000_000 * 5/11 = 4_545_454.5...
    const result = computeBudgetPacing(BASE);
    expect(result.daysElapsed).toBe(5);
    expect(result.daysRemaining).toBe(5);
    expect(result.expectedSpendToDateIdr).toBeCloseTo(4_545_454.545, 2);
    expect(result.pacingPct).toBeCloseTo(4_500_000 / 4_545_454.545, 5);
    expect(result.status).toBe("ON_PACE");
    expect(result.requiredDailyPaceIdr).toBeCloseTo((10_000_000 - 4_500_000) / 5, 5);
    expect(result.projectedEndOfPeriodSpendIdr).toBeCloseTo((4_500_000 / 5) * 11, 5);
  });

  it("UNDER_PACING when actual spend is meaningfully below expected", () => {
    // expected ~4_545_454, actual 2_000_000 -> ratio ~0.44, well under 0.85
    const result = computeBudgetPacing({ ...BASE, actualSpendIdr: 2_000_000 });
    expect(result.status).toBe("UNDER_PACING");
  });

  it("OVER_PACING when actual spend is meaningfully above expected", () => {
    // expected ~4_545_454, actual 8_000_000 -> ratio ~1.76, well over 1.15
    const result = computeBudgetPacing({ ...BASE, actualSpendIdr: 8_000_000 });
    expect(result.status).toBe("OVER_PACING");
  });

  it("today before startDate: daysElapsed clamped to 0, expectedSpendToDateIdr = 0, actual 0 spend -> ON_PACE with undefined pacingPct", () => {
    const result = computeBudgetPacing({
      ...BASE,
      today: new Date("2025-12-25T00:00:00.000Z"),
      actualSpendIdr: 0,
    });
    expect(result.daysElapsed).toBe(0);
    expect(result.expectedSpendToDateIdr).toBe(0);
    expect(result.pacingPct).toBeUndefined();
    expect(result.status).toBe("ON_PACE");
  });

  it("today before startDate with nonzero real spend -> OVER_PACING (spending before pro-rata budget opens), undefined pacingPct", () => {
    const result = computeBudgetPacing({
      ...BASE,
      today: new Date("2025-12-25T00:00:00.000Z"),
      actualSpendIdr: 500_000,
    });
    expect(result.daysElapsed).toBe(0);
    expect(result.expectedSpendToDateIdr).toBe(0);
    expect(result.pacingPct).toBeUndefined();
    expect(result.status).toBe("OVER_PACING");
  });

  it("today after endDate: daysRemaining = 0, requiredDailyPaceIdr undefined, daysElapsed clamped to full window", () => {
    const result = computeBudgetPacing({
      ...BASE,
      today: new Date("2026-02-01T00:00:00.000Z"),
    });
    expect(result.daysRemaining).toBe(0);
    expect(result.daysElapsed).toBe(11);
    expect(result.requiredDailyPaceIdr).toBeUndefined();
    expect(result.expectedSpendToDateIdr).toBe(10_000_000);
  });

  it("echoes actualSpendIdr = 0 as a real, distinct-from-UNKNOWN value", () => {
    const result = computeBudgetPacing({ ...BASE, actualSpendIdr: 0 });
    expect(result.actualSpendIdr).toBe(0);
    expect(result.status).not.toBe("UNKNOWN");
  });
});
