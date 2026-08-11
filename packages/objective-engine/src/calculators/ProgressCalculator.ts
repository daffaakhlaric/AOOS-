import type { IProgressCalculator } from "../contracts/IProgressCalculator.js";
import { classifyOnTrackStatus, OnTrackStatus } from "../domain/value-objects/OnTrackStatus.js";
import type {
  ProgressCalculationInput,
  ProgressCalculationOutput,
} from "../types/ObjectiveTypes.js";

import { calculateBudgetBurnRate, calculateProjectedBudgetAtEnd } from "./BudgetBurnCalculator.js";
import {
  calculateDailyRunRate,
  calculateRemainingHotLeads,
  calculateRequiredDailyRunRate,
} from "./DailyRunRateCalculator.js";

/**
 * Computes every derived metric an `ObjectiveProgress` snapshot needs (spec:
 * `ProgressCalculator.ts ← current leads / target leads`), composing the smaller single-purpose
 * calculators (`DailyRunRateCalculator`, `BudgetBurnCalculator`) plus the on-track classification
 * rule (spec "On-Track Calculation").
 *
 * Division-by-zero / boundary resolution (package report):
 *  - If the target is already met (`remainingHotLeads === 0`), status is unconditionally
 *    `ON_TRACK` — no ratio division needed or meaningful.
 *  - Else if `daysRemaining === 0` (target not yet met, no days left), status is
 *    unconditionally `OFF_TRACK` — matches the guidance "treat onTrackStatus as determined
 *    purely by whether currentHotLeads >= targetHotLeads" at that point.
 *  - Else the normal ratio (`dailyRunRate / requiredDailyRunRate`) is classified via the spec's
 *    0.85/0.60 thresholds — `requiredDailyRunRate` is guaranteed `> 0` in this branch since
 *    `remainingHotLeads > 0` and `daysRemaining > 0`, so the division is always safe here.
 */
export class ProgressCalculator implements IProgressCalculator {
  calculate(input: ProgressCalculationInput): ProgressCalculationOutput {
    const remainingHotLeads = calculateRemainingHotLeads(
      input.targetHotLeads,
      input.currentHotLeads,
    );
    const dailyRunRate = calculateDailyRunRate(input.currentHotLeads, input.daysElapsed);
    const requiredDailyRunRate = calculateRequiredDailyRunRate(
      remainingHotLeads,
      input.daysRemaining,
    );
    const budgetBurnRate = calculateBudgetBurnRate(input.currentSpend, input.daysElapsed);
    const projectedBudgetAtEnd = calculateProjectedBudgetAtEnd(
      input.currentSpend,
      budgetBurnRate,
      input.daysRemaining,
    );
    const progressPercentage =
      input.targetHotLeads > 0
        ? Math.min(100, Math.max(0, (input.currentHotLeads / input.targetHotLeads) * 100))
        : 0;

    let onTrackStatus: OnTrackStatus;
    let paceRatio: number;
    if (remainingHotLeads === 0) {
      onTrackStatus = OnTrackStatus.ON_TRACK;
      paceRatio = 1;
    } else if (input.daysRemaining === 0) {
      onTrackStatus = OnTrackStatus.OFF_TRACK;
      paceRatio = 0;
    } else {
      paceRatio = dailyRunRate / requiredDailyRunRate;
      onTrackStatus = classifyOnTrackStatus(
        paceRatio,
        input.onTrackThreshold,
        input.atRiskThreshold,
      );
    }

    return {
      progressPercentage,
      dailyRunRate,
      requiredDailyRunRate,
      budgetBurnRate,
      projectedBudgetAtEnd,
      onTrackStatus,
      paceRatio,
    };
  }
}
