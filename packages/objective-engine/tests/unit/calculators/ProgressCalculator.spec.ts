import { describe, expect, it } from "vitest";

import { ProgressCalculator } from "../../../src/calculators/ProgressCalculator.js";
import { OnTrackStatus } from "../../../src/domain/value-objects/OnTrackStatus.js";
import type { ProgressCalculationInput } from "../../../src/types/ObjectiveTypes.js";

function baseInput(overrides?: Partial<ProgressCalculationInput>): ProgressCalculationInput {
  return {
    currentHotLeads: 12,
    currentSpend: 8_500_000,
    targetHotLeads: 50,
    budgetAllocation: 30_000_000,
    daysElapsed: 8,
    daysRemaining: 23,
    onTrackThreshold: 0.85,
    atRiskThreshold: 0.6,
    ...overrides,
  };
}

describe("ProgressCalculator — spec worked example", () => {
  const calculator = new ProgressCalculator();

  it("progressPercentage: 12/50 = 24%", () => {
    const result = calculator.calculate(baseInput());
    expect(result.progressPercentage).toBe(24);
  });

  it("dailyRunRate: 12/8 = 1.5", () => {
    const result = calculator.calculate(baseInput());
    expect(result.dailyRunRate).toBe(1.5);
  });

  it("requiredDailyRunRate: (50-12)/23 ~= 1.65", () => {
    const result = calculator.calculate(baseInput());
    expect(result.requiredDailyRunRate).toBeCloseTo(1.6521739130434783, 10);
  });

  it("budgetBurnRate: Rp 8.5jt / 8 days = Rp 1.0625jt/day (pinned)", () => {
    const result = calculator.calculate(baseInput());
    expect(result.budgetBurnRate).toBe(1_062_500);
  });

  it("projectedBudgetAtEnd: currentSpend + budgetBurnRate * daysRemaining (cumulative)", () => {
    const result = calculator.calculate(baseInput());
    expect(result.projectedBudgetAtEnd).toBe(8_500_000 + 1_062_500 * 23);
  });
});

describe("ProgressCalculator — on-track boundary (exact)", () => {
  const calculator = new ProgressCalculator();

  it("ratio=0.84 -> AT_RISK", () => {
    // dailyRunRate / requiredDailyRunRate = 0.84 exactly: currentHotLeads=8.4/day of required
    // required = 10, actual = 8.4 -> ratio 0.84
    const result = calculator.calculate(
      baseInput({
        currentHotLeads: 8.4 * 8,
        daysElapsed: 8,
        targetHotLeads: 8.4 * 8 + 10 * 1,
        daysRemaining: 1,
      }),
    );
    expect(result.paceRatio).toBeCloseTo(0.84, 10);
    expect(result.onTrackStatus).toBe(OnTrackStatus.AT_RISK);
  });

  it("ratio=0.85 -> ON_TRACK (boundary, inclusive)", () => {
    const result = calculator.calculate(
      baseInput({
        currentHotLeads: 8.5 * 8,
        daysElapsed: 8,
        targetHotLeads: 8.5 * 8 + 10 * 1,
        daysRemaining: 1,
      }),
    );
    expect(result.paceRatio).toBeCloseTo(0.85, 10);
    expect(result.onTrackStatus).toBe(OnTrackStatus.ON_TRACK);
  });

  it("ratio=0.60 -> AT_RISK (boundary, inclusive)", () => {
    const result = calculator.calculate(
      baseInput({
        currentHotLeads: 6 * 8,
        daysElapsed: 8,
        targetHotLeads: 6 * 8 + 10 * 1,
        daysRemaining: 1,
      }),
    );
    expect(result.paceRatio).toBeCloseTo(0.6, 10);
    expect(result.onTrackStatus).toBe(OnTrackStatus.AT_RISK);
  });

  it("ratio just below 0.60 -> OFF_TRACK", () => {
    const result = calculator.calculate(
      baseInput({
        currentHotLeads: 5.9 * 8,
        daysElapsed: 8,
        targetHotLeads: 5.9 * 8 + 10 * 1,
        daysRemaining: 1,
      }),
    );
    expect(result.onTrackStatus).toBe(OnTrackStatus.OFF_TRACK);
  });
});

describe("ProgressCalculator — division-by-zero / edge cases", () => {
  const calculator = new ProgressCalculator();

  it("target already met (remainingHotLeads=0) -> unconditionally ON_TRACK, paceRatio=1", () => {
    const result = calculator.calculate(baseInput({ currentHotLeads: 50, targetHotLeads: 50 }));
    expect(result.onTrackStatus).toBe(OnTrackStatus.ON_TRACK);
    expect(result.paceRatio).toBe(1);
  });

  it("currentHotLeads exceeds target -> still ON_TRACK", () => {
    const result = calculator.calculate(baseInput({ currentHotLeads: 60, targetHotLeads: 50 }));
    expect(result.onTrackStatus).toBe(OnTrackStatus.ON_TRACK);
  });

  it("daysRemaining=0 and target not met -> unconditionally OFF_TRACK, paceRatio=0", () => {
    const result = calculator.calculate(
      baseInput({ currentHotLeads: 12, targetHotLeads: 50, daysRemaining: 0 }),
    );
    expect(result.onTrackStatus).toBe(OnTrackStatus.OFF_TRACK);
    expect(result.paceRatio).toBe(0);
  });

  it("daysElapsed=0 -> dailyRunRate=0, never NaN", () => {
    const result = calculator.calculate(baseInput({ daysElapsed: 0, currentHotLeads: 0 }));
    expect(result.dailyRunRate).toBe(0);
    expect(Number.isFinite(result.dailyRunRate)).toBe(true);
  });

  it("daysElapsed=0 -> budgetBurnRate=0, never NaN", () => {
    const result = calculator.calculate(baseInput({ daysElapsed: 0, currentSpend: 0 }));
    expect(result.budgetBurnRate).toBe(0);
    expect(Number.isFinite(result.budgetBurnRate)).toBe(true);
  });

  it("targetHotLeads=0 -> progressPercentage=0 (guarded, never divides by zero)", () => {
    const result = calculator.calculate(baseInput({ targetHotLeads: 0, currentHotLeads: 0 }));
    expect(result.progressPercentage).toBe(0);
  });

  it("progressPercentage never exceeds 100 even if currentHotLeads > target", () => {
    const result = calculator.calculate(baseInput({ currentHotLeads: 200, targetHotLeads: 50 }));
    expect(result.progressPercentage).toBe(100);
  });

  it("no NaN/Infinity leaks anywhere when both daysElapsed and daysRemaining are 0", () => {
    const result = calculator.calculate(
      baseInput({ daysElapsed: 0, daysRemaining: 0, currentHotLeads: 0, currentSpend: 0 }),
    );
    for (const value of [
      result.progressPercentage,
      result.dailyRunRate,
      result.requiredDailyRunRate,
      result.budgetBurnRate,
      result.projectedBudgetAtEnd,
      result.paceRatio,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
