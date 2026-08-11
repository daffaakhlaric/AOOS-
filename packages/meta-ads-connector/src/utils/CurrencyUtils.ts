/**
 * IDR currency helpers. Meta reports/accepts budget fields (`daily_budget`) in *cents* — the
 * smallest currency subunit Meta's API uses regardless of the account's actual currency having
 * no minor unit in everyday IDR usage — while every AAOS domain Value Object (`Spend`, `Budget`,
 * `Rph`) operates in whole Rupiah. Getting this ×100/÷100 conversion backwards would be a real
 * financial bug (a budget 100x too large or too small), so it is centralized here and unit-tested
 * exhaustively rather than inlined at each call site.
 */

/** Meta cents → whole Rupiah. Truncates any fractional cent remainder (Meta never sends fractional cents in practice). */
export function centsToRupiah(cents: number): number {
  return Math.trunc(cents) / 100;
}

/** Whole Rupiah → Meta cents, rounded to the nearest integer cent (Meta rejects non-integer `daily_budget`). */
export function rupiahToCents(rupiah: number): number {
  return Math.round(rupiah * 100);
}

/** Formats a whole-Rupiah amount as "Rp 12.345" (Indonesian thousands separators, no decimal places — IDR has no practical minor unit in AAOS's UI). */
export function formatIDR(rupiah: number): string {
  const rounded = Math.round(rupiah);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  let grouped = "";
  for (let i = 0; i < digits.length; i += 1) {
    const posFromEnd = digits.length - i;
    grouped += digits[i];
    if (posFromEnd > 1 && posFromEnd % 3 === 1) {
      grouped += ".";
    }
  }
  return `${sign}Rp ${grouped}`;
}
