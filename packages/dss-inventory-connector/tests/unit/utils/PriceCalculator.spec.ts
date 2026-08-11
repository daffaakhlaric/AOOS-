import { describe, expect, it } from "vitest";

import { estimatedDp, estimatedMonthly } from "../../../src/utils/PriceCalculator.js";

describe("estimatedDp", () => {
  it("computes 15% of price, rounded to the nearest juta (spec pinned example)", () => {
    // 195_000_000 × 0.15 = 29_250_000 → rounds to 29_000_000
    expect(estimatedDp(195_000_000)).toBe(29_000_000);
  });

  it("rounds up when the fractional juta is >= 0.5", () => {
    // 190_000_000 × 0.15 = 28_500_000 → 28.5 juta rounds to 29 juta
    expect(estimatedDp(190_000_000)).toBe(29_000_000);
  });

  it("returns 0 for a price of 0", () => {
    expect(estimatedDp(0)).toBe(0);
  });
});

describe("estimatedMonthly", () => {
  it("computes the flat-rate monthly installment within the spec's ±100,000 tolerance (corrected formula, resolution #4)", () => {
    // price=195_000_000, dp=29_000_000 → loan=166_000_000, spec pins monthly ≈ 5_447_333
    const monthly = estimatedMonthly(195_000_000, 29_000_000);
    expect(Math.abs(monthly - 5_447_333)).toBeLessThanOrEqual(100_000);
  });

  it("matches the algebraically-identical (loan × 48 × 0.012 + loan) / 48 form exactly", () => {
    const price = 195_000_000;
    const dp = 29_000_000;
    const loan = price - dp;
    const expected = Math.round((loan * 48 * 0.012 + loan) / 48);
    expect(estimatedMonthly(price, dp)).toBe(expected);
  });

  it("returns 0 when the loan amount is 0 (dp equals price)", () => {
    expect(estimatedMonthly(100_000_000, 100_000_000)).toBe(0);
  });

  it("clamps the loan amount at 0 when dp exceeds price defensively", () => {
    expect(estimatedMonthly(100_000_000, 150_000_000)).toBe(0);
  });
});
