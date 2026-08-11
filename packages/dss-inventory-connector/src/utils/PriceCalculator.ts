/** Flat-rate installment tenor, in months, used by `estimatedMonthly`. */
export const INSTALLMENT_TENOR_MONTHS = 48;

/** Flat monthly interest rate used by `estimatedMonthly`. */
export const FLAT_MONTHLY_RATE = 0.012;

/**
 * Estimated down payment: 15% of `price`, rounded to the nearest whole Rp 1,000,000 (juta).
 * Example (pinned by the spec): `price = 195_000_000` → `29_250_000` rounded → `29_000_000`.
 */
export function estimatedDp(price: number): number {
  return Math.round((price * 0.15) / 1_000_000) * 1_000_000;
}

/**
 * Estimated flat-rate monthly installment on the loan amount `price - dp`.
 *
 * Judgment call (documented in the engineering report's resolution #4): the spec's own inline
 * comment on `InventoryUnit.estimatedMonthly` — `(price - dp) × 48 × 0.012 / 48 approx` —
 * algebraically cancels its own `×48`/`/48` down to just `(price-dp) × 0.012`, which does not
 * match the spec's own separately pinned example (`loan = 166_000_000` → `monthly ≈ 5_447_333`).
 * The spec's `PriceCalculator.spec.ts` pinned formula, `(loan × 48 × 0.012 + loan) / 48`, is the
 * correct one — it is algebraically identical to the standard flat-rate installment formula
 * `loan / tenor + loan × monthlyRate` (both reduce to `loan × (1/tenor + monthlyRate)`), which is
 * what `@aos/meta-ads-agent`'s (AAOS-W1D-S1S2) `@aos/objective-engine` predecessor already
 * established for this exact business calculation. Implemented here in that standard form.
 */
export function estimatedMonthly(price: number, dp: number): number {
  const loan = Math.max(0, price - dp);
  const monthly = loan / INSTALLMENT_TENOR_MONTHS + loan * FLAT_MONTHLY_RATE;
  return Math.round(monthly);
}
