/**
 * Spend-pace math (spec: "budget_burn: Rp 8.5jt in 8 days → Rp 1.0625jt/day burn rate").
 * `budgetBurnRate = 0` when `daysElapsed === 0` — same division-by-zero fallback discipline as
 * `DailyRunRateCalculator`.
 */

/** `currentSpend / daysElapsed`, or `0` when `daysElapsed === 0`. */
export function calculateBudgetBurnRate(currentSpend: number, daysElapsed: number): number {
  if (daysElapsed <= 0) {
    return 0;
  }
  return currentSpend / daysElapsed;
}

/**
 * `currentSpend + budgetBurnRate * daysRemaining` — the projected TOTAL cumulative spend by
 * period end (package report "projectedBudgetAtEnd discrepancy" resolution: the spec's inline
 * domain-model comment computes only the projected *remaining* burn
 * (`budgetBurnRate * daysRemaining`) and omits adding back `currentSpend` already spent, which
 * would understate the cumulative total; "projected budget AT END" most sensibly means the full
 * cumulative spend by month-end, so `currentSpend` is included here).
 */
export function calculateProjectedBudgetAtEnd(
  currentSpend: number,
  budgetBurnRate: number,
  daysRemaining: number,
): number {
  return currentSpend + budgetBurnRate * daysRemaining;
}
