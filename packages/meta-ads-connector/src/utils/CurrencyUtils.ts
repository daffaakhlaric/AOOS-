/** Legacy read compatibility only. IDR provider units are UNVERIFIED; production budget writes are blocked in MetaApiClient. Use MetaMoney contracts for new code. */
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
