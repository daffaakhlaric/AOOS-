import { describe, expect, it } from "vitest";

import {
  calculateDailyRunRate,
  calculateRemainingHotLeads,
  calculateRequiredDailyRunRate,
} from "../../../src/calculators/DailyRunRateCalculator.js";

describe("calculateDailyRunRate", () => {
  it("spec worked example: 12/8 = 1.5", () => {
    expect(calculateDailyRunRate(12, 8)).toBe(1.5);
  });

  it("returns 0 when daysElapsed is 0", () => {
    expect(calculateDailyRunRate(12, 0)).toBe(0);
  });

  it("returns 0 when daysElapsed is negative", () => {
    expect(calculateDailyRunRate(12, -1)).toBe(0);
  });

  it("returns 0 for 0 hot leads", () => {
    expect(calculateDailyRunRate(0, 8)).toBe(0);
  });
});

describe("calculateRequiredDailyRunRate", () => {
  it("spec worked example: (50-12)/23 ~= 1.65", () => {
    expect(calculateRequiredDailyRunRate(38, 23)).toBeCloseTo(1.6521739130434783, 10);
  });

  it("returns 0 when daysRemaining is 0", () => {
    expect(calculateRequiredDailyRunRate(38, 0)).toBe(0);
  });

  it("returns 0 when remainingHotLeads is 0 (target already met)", () => {
    expect(calculateRequiredDailyRunRate(0, 23)).toBe(0);
  });

  it("returns 0 when remainingHotLeads is negative", () => {
    expect(calculateRequiredDailyRunRate(-5, 23)).toBe(0);
  });

  it("returns 0 when both are 0", () => {
    expect(calculateRequiredDailyRunRate(0, 0)).toBe(0);
  });
});

describe("calculateRemainingHotLeads", () => {
  it("computes target minus current", () => {
    expect(calculateRemainingHotLeads(50, 12)).toBe(38);
  });

  it("never returns negative — clamps at 0 when current exceeds target", () => {
    expect(calculateRemainingHotLeads(50, 60)).toBe(0);
  });

  it("returns 0 when current equals target", () => {
    expect(calculateRemainingHotLeads(50, 50)).toBe(0);
  });
});
