/** Formats a whole-Rupiah amount using Indonesian thousands separators, e.g. `formatIDR(30000000) === "Rp 30.000.000"`. */
export function formatIDR(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  const withSeparators = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}Rp ${withSeparators}`;
}

/** The fraction (0-1) of `budgetAllocation` already spent. `0` when `budgetAllocation <= 0` (never `NaN`/`Infinity`). */
export function budgetUsedFraction(currentSpend: number, budgetAllocation: number): number {
  if (budgetAllocation <= 0) {
    return 0;
  }
  return Math.min(1, currentSpend / budgetAllocation);
}
