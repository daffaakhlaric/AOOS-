/**
 * Campaign Page Rebuild v2 — real calendar-date math shared by `BudgetTracker.tsx` (Prompt 5,
 * dailyBudget-estimated progress) and `ObjectiveStripCard.tsx` (Prompt 4, projected end-of-month
 * HOT-lead estimate). Both use the exact same "elapsed days / total days in the current real
 * calendar month" pace basis so their two estimates can never silently use different day math.
 * UTC-based so the estimate is stable regardless of the viewer's local timezone.
 */
export function daysElapsedInMonth(now: Date): number {
  return now.getUTCDate();
}

export function daysInMonth(now: Date): number {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
}
