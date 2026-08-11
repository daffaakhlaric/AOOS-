/**
 * Cost-efficiency ratios (spec: `RoiCalculator.ts ← cost per hot lead, cost per SPK`). "SPK"
 * (Surat Pesanan Kendaraan — vehicle order form) is DSS Motor's further-down-funnel conversion
 * event; this package does not itself track SPK counts (out of scope per Mission — no lead
 * store, no CRM), so `costPerSPK` takes a caller-supplied count, ready for a future
 * `@aos/lead-store`-backed caller. Both return `null` (never `NaN`/`Infinity`) when the count is
 * zero or non-finite — mirroring `@aos/meta-ads-connector`'s `Rph` "no rate available" convention.
 */

export function costPerHotLead(spend: number, hotLeadsCount: number): number | null {
  return safeDivide(spend, hotLeadsCount);
}

export function costPerSPK(spend: number, spkCount: number): number | null {
  return safeDivide(spend, spkCount);
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}
