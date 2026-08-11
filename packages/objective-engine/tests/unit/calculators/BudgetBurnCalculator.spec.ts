import { describe, expect, it } from "vitest";

import {
  calculateBudgetBurnRate,
  calculateProjectedBudgetAtEnd,
} from "../../../src/calculators/BudgetBurnCalculator.js";

describe("calculateBudgetBurnRate", () => {
  it("pinned business-correctness value: Rp 8.5jt in 8 days -> Rp 1.0625jt/day", () => {
    expect(calculateBudgetBurnRate(8_500_000, 8)).toBe(1_062_500);
  });

  it("returns 0 when daysElapsed is 0 (division-by-zero safety)", () => {
    expect(calculateBudgetBurnRate(1_000_000, 0)).toBe(0);
  });

  it("returns 0 when daysElapsed is negative", () => {
    expect(calculateBudgetBurnRate(1_000_000, -1)).toBe(0);
  });

  it("returns 0 for 0 spend", () => {
    expect(calculateBudgetBurnRate(0, 8)).toBe(0);
  });
});

describe("calculateProjectedBudgetAtEnd", () => {
  it("is cumulative: currentSpend + budgetBurnRate * daysRemaining", () => {
    expect(calculateProjectedBudgetAtEnd(8_500_000, 1_062_500, 23)).toBe(
      8_500_000 + 1_062_500 * 23,
    );
  });

  it("equals currentSpend when budgetBurnRate is 0", () => {
    expect(calculateProjectedBudgetAtEnd(8_500_000, 0, 23)).toBe(8_500_000);
  });

  it("equals currentSpend when daysRemaining is 0", () => {
    expect(calculateProjectedBudgetAtEnd(8_500_000, 1_062_500, 0)).toBe(8_500_000);
  });

  it("computes correctly starting from 0 spend", () => {
    expect(calculateProjectedBudgetAtEnd(0, 1_000_000, 5)).toBe(5_000_000);
  });
});
