import { describe, expect, it } from "vitest";

import { ForecastCalculator } from "../../../src/calculators/ForecastCalculator.js";
import { OnTrackStatus } from "../../../src/domain/value-objects/OnTrackStatus.js";
import type { ForecastStrategyInput } from "../../../src/types/ObjectiveTypes.js";

const NOW = new Date("2026-08-09T00:00:00.000Z");

function baseInput(overrides?: Partial<ForecastStrategyInput>): ForecastStrategyInput {
  return {
    currentHotLeads: 12,
    targetHotLeads: 50,
    currentSpend: 8_500_000,
    budgetAllocation: 300_000_000,
    dailyRunRate: 1.5,
    budgetBurnRate: 1_062_500,
    daysElapsed: 8,
    daysRemaining: 23,
    requiredDailyRunRate: (50 - 12) / 23,
    onTrackStatus: OnTrackStatus.AT_RISK,
    now: NOW,
    ...overrides,
  };
}

describe("ForecastCalculator — linear projection", () => {
  const calculator = new ForecastCalculator();

  it("pinned business-correctness value: 12 hot leads in 8 days, 23 days remaining -> forecast=46", () => {
    const result = calculator.forecast(baseInput());
    // Math.floor(12 + (12/8)*23) = Math.floor(46.5) = 46
    expect(result.forecastedHotLeads).toBe(46);
  });

  it("always floors, never rounds to nearest", () => {
    const result = calculator.forecast(
      baseInput({ currentHotLeads: 0, dailyRunRate: 1, daysRemaining: 10 }),
    );
    expect(result.forecastedHotLeads).toBe(10);
  });

  it("computes forecastedSpend as currentSpend + budgetBurnRate * daysRemaining when not budget-constrained", () => {
    const result = calculator.forecast(baseInput());
    expect(result.forecastedSpend).toBe(Math.round(8_500_000 + 1_062_500 * 23));
  });

  it("never returns a negative forecastedHotLeads", () => {
    const result = calculator.forecast(
      baseInput({ currentHotLeads: 0, dailyRunRate: 0, daysRemaining: 0 }),
    );
    expect(result.forecastedHotLeads).toBe(0);
  });
});

describe("ForecastCalculator — budget-constrained branch", () => {
  const calculator = new ForecastCalculator();

  it("switches to the budget-constrained forecast when days_can_sustain < days_remaining", () => {
    // budgetRemaining = 30M - 28M = 2M; burnRate = 1M/day -> daysCanSustain = 2 < daysRemaining 23
    const input = baseInput({
      currentSpend: 28_000_000,
      budgetAllocation: 30_000_000,
      budgetBurnRate: 1_000_000,
      currentHotLeads: 12,
      dailyRunRate: 1.5,
      daysRemaining: 23,
    });
    const result = calculator.forecast(input);
    // forecastedTotalRaw = 12 + 1.5*2 = 15
    expect(result.forecastedHotLeads).toBe(15);
    // forecastedSpend = full budgetAllocation when budget-constrained
    expect(result.forecastedSpend).toBe(30_000_000);
  });

  it("sets budgetExhaustedAt when budget-constrained, computed from daysCanSustain", () => {
    const input = baseInput({
      currentSpend: 28_000_000,
      budgetAllocation: 30_000_000,
      budgetBurnRate: 1_000_000,
      daysRemaining: 23,
      now: NOW,
    });
    const result = calculator.forecast(input);
    const expected = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect(result.budgetExhaustedAt).toEqual(expected);
  });

  it("omits budgetExhaustedAt when not budget-constrained", () => {
    const result = calculator.forecast(baseInput());
    expect(result.budgetExhaustedAt).toBeUndefined();
  });

  it("treats budgetBurnRate === 0 as unbounded sustain (never divides by zero)", () => {
    const input = baseInput({ budgetBurnRate: 0, currentSpend: 0, budgetAllocation: 30_000_000 });
    const result = calculator.forecast(input);
    // linear branch wins since daysCanSustain = Infinity
    expect(result.forecastedHotLeads).toBe(46);
    expect(result.budgetExhaustedAt).toBeUndefined();
    expect(Number.isFinite(result.forecastedHotLeads)).toBe(true);
  });

  it("clamps effectiveDays at 0 when budget is already fully exhausted (budgetRemaining=0)", () => {
    const input = baseInput({
      currentSpend: 30_000_000,
      budgetAllocation: 30_000_000,
      budgetBurnRate: 1_000_000,
      currentHotLeads: 12,
      daysRemaining: 23,
    });
    const result = calculator.forecast(input);
    expect(result.forecastedHotLeads).toBe(12);
  });
});

describe("ForecastCalculator — probability heuristic", () => {
  const calculator = new ForecastCalculator();

  it("ON_TRACK + will meet target -> probability 90", () => {
    const result = calculator.forecast(
      baseInput({
        onTrackStatus: OnTrackStatus.ON_TRACK,
        currentHotLeads: 50,
        targetHotLeads: 50,
        dailyRunRate: 5,
        daysRemaining: 10,
      }),
    );
    expect(result.probability).toBe(90);
  });

  it("ON_TRACK + will not meet target -> probability 65", () => {
    const result = calculator.forecast(
      baseInput({
        onTrackStatus: OnTrackStatus.ON_TRACK,
        currentHotLeads: 0,
        targetHotLeads: 1000,
        dailyRunRate: 0.1,
        daysRemaining: 5,
      }),
    );
    expect(result.probability).toBe(65);
  });

  it("AT_RISK + will meet target -> probability 60", () => {
    const result = calculator.forecast(
      baseInput({
        onTrackStatus: OnTrackStatus.AT_RISK,
        currentHotLeads: 50,
        targetHotLeads: 50,
      }),
    );
    expect(result.probability).toBe(60);
  });

  it("AT_RISK + will not meet target -> probability 40", () => {
    const result = calculator.forecast(
      baseInput({ onTrackStatus: OnTrackStatus.AT_RISK, currentHotLeads: 0, targetHotLeads: 1000 }),
    );
    expect(result.probability).toBe(40);
  });

  it("OFF_TRACK + will meet target -> probability 30", () => {
    const result = calculator.forecast(
      baseInput({
        onTrackStatus: OnTrackStatus.OFF_TRACK,
        currentHotLeads: 50,
        targetHotLeads: 50,
      }),
    );
    expect(result.probability).toBe(30);
  });

  it("OFF_TRACK + will not meet target -> probability 10", () => {
    const result = calculator.forecast(
      baseInput({
        onTrackStatus: OnTrackStatus.OFF_TRACK,
        currentHotLeads: 0,
        targetHotLeads: 1000,
      }),
    );
    expect(result.probability).toBe(10);
  });
});

describe("ForecastCalculator — daysToTarget", () => {
  const calculator = new ForecastCalculator();

  it("computes daysToTarget when ON_TRACK, target not yet met, positive run rate", () => {
    const result = calculator.forecast(
      baseInput({
        onTrackStatus: OnTrackStatus.ON_TRACK,
        currentHotLeads: 12,
        targetHotLeads: 50,
        dailyRunRate: 2,
      }),
    );
    expect(result.daysToTarget).toBe(Math.ceil((50 - 12) / 2));
  });

  it("returns daysToTarget 0 when target already met and ON_TRACK", () => {
    const result = calculator.forecast(
      baseInput({ onTrackStatus: OnTrackStatus.ON_TRACK, currentHotLeads: 50, targetHotLeads: 50 }),
    );
    expect(result.daysToTarget).toBe(0);
  });

  it("omits daysToTarget when not ON_TRACK", () => {
    const result = calculator.forecast(baseInput({ onTrackStatus: OnTrackStatus.AT_RISK }));
    expect(result.daysToTarget).toBeUndefined();
  });

  it("omits daysToTarget when ON_TRACK but dailyRunRate is 0", () => {
    const result = calculator.forecast(
      baseInput({
        onTrackStatus: OnTrackStatus.ON_TRACK,
        currentHotLeads: 12,
        targetHotLeads: 50,
        dailyRunRate: 0,
      }),
    );
    expect(result.daysToTarget).toBeUndefined();
  });
});
