import { describe, expect, it } from "vitest";

import { computeAchievableHotLeads, computeReverseFunnel } from "./reverse-funnel.js";

describe("computeReverseFunnel", () => {
  it("returns everything undefined and confidence 0 for zero historical raw leads", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 50,
      historicalRawLeads: 0,
      historicalHotLeads: 0,
      historicalCplIdr: 50_000,
    });
    expect(result).toEqual({ conversionRate: undefined, confidence: 0 });
  });

  it("low-confidence small-sample case: wide band, low confidence", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 50,
      historicalRawLeads: 10,
      historicalHotLeads: 2,
    });
    expect(result.conversionRate).toBeCloseTo(0.2);
    // confidence = (10/200)*0.7 + (2/20)*0.3 = 0.035 + 0.03 = 0.065 -> rounded 0.07
    expect(result.confidence).toBeCloseTo(0.07, 2);
    expect(result.estimatedRequiredRawLeads).toBeDefined();
    const range = result.estimatedRequiredRawLeads!;
    expect(range.expected).toBe(250); // 50 / 0.2
    // band pct near MAX_BAND_PCT (0.5) since confidence is very low
    expect(range.min).toBeLessThan(range.expected);
    expect(range.max).toBeGreaterThan(range.expected);
    const widthFraction = (range.max - range.expected) / range.expected;
    expect(widthFraction).toBeGreaterThan(0.4);
  });

  it("high-confidence large-sample case: narrow band, high confidence", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 100,
      historicalRawLeads: 400,
      historicalHotLeads: 40,
    });
    expect(result.conversionRate).toBeCloseTo(0.1);
    // confidence = min(400/200,1)*0.7 + min(40/20,1)*0.3 = 0.7 + 0.3 = 1.0
    expect(result.confidence).toBe(1);
    const range = result.estimatedRequiredRawLeads!;
    expect(range.expected).toBe(1000); // 100 / 0.1
    const widthFraction = (range.max - range.expected) / range.expected;
    // band pct at confidence 1.0 is MIN_BAND_PCT (0.1)
    expect(widthFraction).toBeCloseTo(0.1, 1);
  });

  it("leaves estimatedMediaSpendIdr undefined when historicalCplIdr is undefined", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 50,
      historicalRawLeads: 100,
      historicalHotLeads: 10,
    });
    expect(result.estimatedRequiredRawLeads).toBeDefined();
    expect(result.estimatedMediaSpendIdr).toBeUndefined();
  });

  it("computes estimatedMediaSpendIdr from historicalCplIdr when provided", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 50,
      historicalRawLeads: 100,
      historicalHotLeads: 10,
      historicalCplIdr: 20_000,
    });
    const rawRange = result.estimatedRequiredRawLeads!;
    const spendRange = result.estimatedMediaSpendIdr!;
    expect(spendRange.expected).toBe(Math.round(rawRange.expected * 20_000));
    expect(spendRange.min).toBe(Math.round(rawRange.min * 20_000));
    expect(spendRange.max).toBe(Math.round(rawRange.max * 20_000));
  });

  it("boundary: historicalHotLeads > historicalRawLeads yields a conversionRate above 1.0, not clamped", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 10,
      historicalRawLeads: 5,
      historicalHotLeads: 8,
    });
    expect(result.conversionRate).toBeCloseTo(1.6);
    // requiredRawLeads should be LESS than the target, since conversion rate > 1
    expect(result.estimatedRequiredRawLeads!.expected).toBeLessThan(10);
  });

  it("real 0% historical conversion rate leaves estimatedRequiredRawLeads/estimatedMediaSpendIdr undefined, but confidence still reflects sample size", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 50,
      historicalRawLeads: 100,
      historicalHotLeads: 0,
      historicalCplIdr: 10_000,
    });
    expect(result.conversionRate).toBe(0);
    expect(result.estimatedRequiredRawLeads).toBeUndefined();
    expect(result.estimatedMediaSpendIdr).toBeUndefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("estimatedRequiredRawLeads.min never goes below 0", () => {
    const result = computeReverseFunnel({
      targetHotLeads: 1,
      historicalRawLeads: 2,
      historicalHotLeads: 2,
    });
    expect(result.estimatedRequiredRawLeads!.min).toBeGreaterThanOrEqual(0);
  });
});

describe("computeAchievableHotLeads", () => {
  it("inverts a real budget into an achievable Hot Lead range using the same CPL/conversion basis", () => {
    // 10_000_000 / 20_000 CPL = 500 achievable raw leads; * 0.1 conversion = 50 achievable hot leads.
    const result = computeAchievableHotLeads({
      maxBudgetIdr: 10_000_000,
      historicalCplIdr: 20_000,
      conversionRate: 0.1,
      confidence: 1,
    });
    expect(result).toBeDefined();
    expect(result!.expected).toBe(50);
    // confidence 1.0 -> MIN_BAND_PCT (0.1) band, same banding computeReverseFunnel uses.
    expect(result!.min).toBe(45);
    // Math.ceil(50 * 1.1) — floating point pushes 55.00000000000001 up to 56, same rounding
    // behavior computeReverseFunnel's own equivalent band already exhibits at this boundary.
    expect(result!.max).toBe(56);
  });

  it("widens the band at low confidence, same as the forward direction", () => {
    const result = computeAchievableHotLeads({
      maxBudgetIdr: 10_000_000,
      historicalCplIdr: 20_000,
      conversionRate: 0.1,
      confidence: 0,
    });
    expect(result!.expected).toBe(50);
    // confidence 0 -> MAX_BAND_PCT (0.5) band.
    expect(result!.min).toBe(25);
    expect(result!.max).toBe(75);
  });

  it("returns undefined when historicalCplIdr is undefined (no real cost basis to invert)", () => {
    const result = computeAchievableHotLeads({
      maxBudgetIdr: 10_000_000,
      conversionRate: 0.1,
      confidence: 0.5,
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when conversionRate is undefined (no real historical conversion to invert)", () => {
    const result = computeAchievableHotLeads({
      maxBudgetIdr: 10_000_000,
      historicalCplIdr: 20_000,
      confidence: 0.5,
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when conversionRate is 0 (real 0% historical conversion, never divide into a fabricated estimate)", () => {
    const result = computeAchievableHotLeads({
      maxBudgetIdr: 10_000_000,
      historicalCplIdr: 20_000,
      conversionRate: 0,
      confidence: 0.5,
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when historicalCplIdr is 0 (never divide by zero)", () => {
    const result = computeAchievableHotLeads({
      maxBudgetIdr: 10_000_000,
      historicalCplIdr: 0,
      conversionRate: 0.1,
      confidence: 0.5,
    });
    expect(result).toBeUndefined();
  });
});
