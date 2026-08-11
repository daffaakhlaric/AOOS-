/**
 * Pace math (spec: "On-Track Calculation"). Division-by-zero safety per the package report's
 * documented fallback rules:
 *  - `daysElapsed === 0` → `dailyRunRate = 0` (no data yet to compute an actual pace).
 *  - `daysRemaining === 0` → `requiredDailyRunRate = 0` (the "rate still needed" concept is moot
 *    once no days remain — the outcome is fully determined by whether target was already hit).
 * Never returns `NaN`/`Infinity`.
 */

/** `current_hot_leads / days_elapsed`, or `0` when `daysElapsed === 0`. */
export function calculateDailyRunRate(currentHotLeads: number, daysElapsed: number): number {
  if (daysElapsed <= 0) {
    return 0;
  }
  return currentHotLeads / daysElapsed;
}

/** `remaining_hot_leads / days_remaining`, or `0` when `daysRemaining === 0` or the target is already met (`remainingHotLeads <= 0`). */
export function calculateRequiredDailyRunRate(
  remainingHotLeads: number,
  daysRemaining: number,
): number {
  if (daysRemaining <= 0 || remainingHotLeads <= 0) {
    return 0;
  }
  return remainingHotLeads / daysRemaining;
}

/** `Math.max(0, targetHotLeads - currentHotLeads)` — never negative. */
export function calculateRemainingHotLeads(
  targetHotLeads: number,
  currentHotLeads: number,
): number {
  return Math.max(0, targetHotLeads - currentHotLeads);
}
