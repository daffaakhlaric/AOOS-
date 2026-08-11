import { describe, expect, it } from "vitest";

import {
  calculateAverageRphD3,
  calculateBudgetPlanning,
  calculateD3Needed,
} from "../../../src/calculators/BackwardPlanningCalculator.js";
import {
  buildAdAccountFixture,
  buildEmptyAdAccountFixture,
} from "../../fixtures/adAccountFixtures.js";

describe("calculateD3Needed", () => {
  it("pinned business-correctness value: target=50, rate=0.18 -> d3_needed=278", () => {
    expect(calculateD3Needed(50, 0.18)).toBe(278);
  });

  it("rounds up (Math.ceil), not nearest", () => {
    // 100 / 0.5 = 200 exactly
    expect(calculateD3Needed(100, 0.5)).toBe(200);
    // 10 / 0.3 = 33.33... -> 34
    expect(calculateD3Needed(10, 0.3)).toBe(34);
  });

  it("returns 0 when hotLeadConversionRate is 0 (division-by-zero safety)", () => {
    expect(calculateD3Needed(50, 0)).toBe(0);
  });

  it("returns 0 when hotLeadConversionRate is negative", () => {
    expect(calculateD3Needed(50, -0.1)).toBe(0);
  });

  it("computes for a small target/rate combination", () => {
    expect(calculateD3Needed(1, 1)).toBe(1);
  });
});

describe("calculateAverageRphD3", () => {
  it("computes the mean rphD3 across every ad with a defined rate", () => {
    const adAccount = buildAdAccountFixture();
    // rphD3 values: 1400, 70000, 5000, 6000, 10000 (Mobilio has 0 D3 -> undefined, excluded)
    const expected = (1_400 + 70_000 + 5_000 + 6_000 + 10_000) / 5;
    expect(calculateAverageRphD3(adAccount)).toBeCloseTo(expected, 6);
  });

  it("returns 0 for a zero-campaigns AdAccount (edge case)", () => {
    expect(calculateAverageRphD3(buildEmptyAdAccountFixture())).toBe(0);
  });
});

describe("calculateBudgetPlanning", () => {
  it("computes budgetNeeded and recommendedBudget with Math.ceil rounding and a 15% buffer", () => {
    const result = calculateBudgetPlanning(278, 8_964, 1.15);
    const expectedBudgetNeeded = Math.ceil(278 * 8_964);
    expect(result.budgetNeeded).toBe(expectedBudgetNeeded);
    expect(result.recommendedBudget).toBe(Math.ceil(expectedBudgetNeeded * 1.15));
  });

  it("rounds budgetNeeded and recommendedBudget up even for fractional inputs", () => {
    const result = calculateBudgetPlanning(3, 100.1, 1.1);
    expect(result.budgetNeeded).toBe(Math.ceil(3 * 100.1));
    expect(Number.isInteger(result.budgetNeeded)).toBe(true);
    expect(Number.isInteger(result.recommendedBudget)).toBe(true);
  });

  it("handles a zero avgRphD3 (e.g. no rate data) producing a zero budget", () => {
    const result = calculateBudgetPlanning(278, 0, 1.15);
    expect(result.budgetNeeded).toBe(0);
    expect(result.recommendedBudget).toBe(0);
  });
});
