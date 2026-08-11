import { describe, expect, it } from "vitest";

import { ObjectiveProgress } from "../../../../src/domain/entities/ObjectiveProgress.js";
import { BudgetAllocation } from "../../../../src/domain/value-objects/BudgetAllocation.js";
import { ForecastScore } from "../../../../src/domain/value-objects/ForecastScore.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { OnTrackStatus } from "../../../../src/domain/value-objects/OnTrackStatus.js";
import { ProgressPercentage } from "../../../../src/domain/value-objects/ProgressPercentage.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function validProps() {
  return {
    objectiveId: ObjectiveId.generate(),
    currentHotLeads: 12,
    currentSpend: unwrap(BudgetAllocation.create(8_500_000)),
    daysElapsed: 8,
    daysRemaining: 23,
    progressPercentage: unwrap(ProgressPercentage.create(24)),
    dailyRunRate: 1.5,
    requiredDailyRunRate: (50 - 12) / 23,
    forecastedHotLeads: unwrap(ForecastScore.create(46)),
    budgetBurnRate: 1_062_500,
    projectedBudgetAtEnd: unwrap(BudgetAllocation.create(33_000_000)),
    onTrackStatus: OnTrackStatus.AT_RISK,
    updatedAt: new Date("2026-08-09T00:00:00.000Z"),
  };
}

describe("ObjectiveProgress", () => {
  it("creates a valid ObjectiveProgress snapshot", () => {
    const progress = unwrap(ObjectiveProgress.create(validProps()));
    expect(progress.currentHotLeads).toBe(12);
    expect(progress.daysElapsed).toBe(8);
    expect(progress.daysRemaining).toBe(23);
    expect(progress.dailyRunRate).toBe(1.5);
    expect(progress.onTrackStatus).toBe(OnTrackStatus.AT_RISK);
  });

  it("exposes every getter matching constructed props", () => {
    const props = validProps();
    const progress = unwrap(ObjectiveProgress.create(props));
    expect(progress.objectiveId).toBe(props.objectiveId);
    expect(progress.currentSpend).toBe(props.currentSpend);
    expect(progress.progressPercentage).toBe(props.progressPercentage);
    expect(progress.requiredDailyRunRate).toBe(props.requiredDailyRunRate);
    expect(progress.forecastedHotLeads).toBe(props.forecastedHotLeads);
    expect(progress.budgetBurnRate).toBe(props.budgetBurnRate);
    expect(progress.projectedBudgetAtEnd).toBe(props.projectedBudgetAtEnd);
    expect(progress.updatedAt).toBe(props.updatedAt);
  });

  it("accepts daysElapsed === 0 with dailyRunRate 0 (division-by-zero fallback)", () => {
    const progress = unwrap(
      ObjectiveProgress.create({
        ...validProps(),
        daysElapsed: 0,
        dailyRunRate: 0,
        budgetBurnRate: 0,
      }),
    );
    expect(progress.daysElapsed).toBe(0);
    expect(progress.dailyRunRate).toBe(0);
    expect(progress.budgetBurnRate).toBe(0);
    expect(Number.isFinite(progress.dailyRunRate)).toBe(true);
  });

  it("accepts daysRemaining === 0 with requiredDailyRunRate 0 (division-by-zero fallback)", () => {
    const progress = unwrap(
      ObjectiveProgress.create({
        ...validProps(),
        daysRemaining: 0,
        requiredDailyRunRate: 0,
        onTrackStatus: OnTrackStatus.OFF_TRACK,
      }),
    );
    expect(progress.daysRemaining).toBe(0);
    expect(progress.requiredDailyRunRate).toBe(0);
    expect(Number.isFinite(progress.requiredDailyRunRate)).toBe(true);
  });

  it("rejects a non-integer currentHotLeads", () => {
    expect(
      unwrapErr(ObjectiveProgress.create({ ...validProps(), currentHotLeads: 1.5 })).message,
    ).toContain("currentHotLeads");
  });

  it("rejects a negative currentHotLeads", () => {
    expect(ObjectiveProgress.create({ ...validProps(), currentHotLeads: -1 }).ok).toBe(false);
  });

  it("rejects a non-integer daysElapsed", () => {
    expect(ObjectiveProgress.create({ ...validProps(), daysElapsed: 1.2 }).ok).toBe(false);
  });

  it("rejects a negative daysElapsed", () => {
    expect(ObjectiveProgress.create({ ...validProps(), daysElapsed: -1 }).ok).toBe(false);
  });

  it("rejects a non-integer daysRemaining", () => {
    expect(ObjectiveProgress.create({ ...validProps(), daysRemaining: 1.2 }).ok).toBe(false);
  });

  it("rejects a negative daysRemaining", () => {
    expect(ObjectiveProgress.create({ ...validProps(), daysRemaining: -1 }).ok).toBe(false);
  });

  it("rejects a NaN dailyRunRate", () => {
    expect(ObjectiveProgress.create({ ...validProps(), dailyRunRate: NaN }).ok).toBe(false);
  });

  it("rejects a negative dailyRunRate", () => {
    expect(ObjectiveProgress.create({ ...validProps(), dailyRunRate: -1 }).ok).toBe(false);
  });

  it("rejects an Infinity dailyRunRate", () => {
    expect(ObjectiveProgress.create({ ...validProps(), dailyRunRate: Infinity }).ok).toBe(false);
  });

  it("rejects a NaN requiredDailyRunRate", () => {
    expect(ObjectiveProgress.create({ ...validProps(), requiredDailyRunRate: NaN }).ok).toBe(false);
  });

  it("rejects a negative requiredDailyRunRate", () => {
    expect(ObjectiveProgress.create({ ...validProps(), requiredDailyRunRate: -1 }).ok).toBe(false);
  });

  it("rejects a NaN budgetBurnRate", () => {
    expect(ObjectiveProgress.create({ ...validProps(), budgetBurnRate: NaN }).ok).toBe(false);
  });

  it("rejects a negative budgetBurnRate", () => {
    expect(ObjectiveProgress.create({ ...validProps(), budgetBurnRate: -1 }).ok).toBe(false);
  });

  it("rejects an invalid onTrackStatus", () => {
    expect(ObjectiveProgress.create({ ...validProps(), onTrackStatus: "BOGUS" as never }).ok).toBe(
      false,
    );
  });

  it("is immutable — props object cannot be mutated externally to affect getters", () => {
    const props = validProps();
    const progress = unwrap(ObjectiveProgress.create(props));
    const before = progress.currentHotLeads;
    props.currentHotLeads = 999;
    expect(progress.currentHotLeads).toBe(before);
  });
});
