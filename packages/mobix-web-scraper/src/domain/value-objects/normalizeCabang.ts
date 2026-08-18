import { Branch } from "@aos/meta-ads-connector";

/**
 * The `cabang` values mobixbydss.id's `/api/get-all-produk` actually returns that DO correspond to a
 * real `@aos/meta-ads-connector` `Branch` member. Verified against live API responses (2026-08-17).
 */
const KNOWN_CABANG: Readonly<Record<string, Branch>> = {
  BINTARO: Branch.BINTARO,
  CINERE: Branch.CINERE,
  BANDUNG: Branch.BANDUNG,
};

/**
 * Maps mobixbydss.id's raw `cabang` string onto `@aos/meta-ads-connector`'s `Branch` enum.
 *
 * REAL DATA GAP (deliberately surfaced, not papered over): the live API returns `cabang` values that
 * have no `Branch` member — `"PONDOK BAMBU"` is a genuine physical dealer branch that the `Branch`
 * enum simply does not model yet, and `"hq3"` looks like an internal warehouse/HQ code rather than a
 * customer-facing branch. Both fall back to `Branch.UMUM` so one unmodelled branch can never fail a
 * whole scrape, and every fallback invokes `onFallback` so the gap shows up as a real WARN line in
 * the scrape job's log instead of vanishing. Adding `Branch` members for these is a product
 * decision, deliberately NOT made here.
 *
 * Matching is case-insensitive and whitespace-trimmed (the API mixes `"Mitsubishi"`/`"MITSUBISHI"`
 * casing in sibling fields, so its `cabang` casing is not assumed stable either).
 */
export function normalizeCabang(raw: string, onFallback?: (raw: string) => void): Branch {
  const key = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  const known = KNOWN_CABANG[key];
  if (known !== undefined) {
    return known;
  }
  onFallback?.(raw);
  return Branch.UMUM;
}
