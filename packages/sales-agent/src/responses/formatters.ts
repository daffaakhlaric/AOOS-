/** Formats a whole-rupiah amount Indonesian-style, e.g. `195000000` → `"195.000.000"`. Shared by `UnitResponses`/`PriceResponses`. */
export function formatPrice(amount: number): string {
  return Math.round(amount).toLocaleString("id-ID");
}

/** Formats a kilometer reading Indonesian-style, e.g. `45000` → `"45.000"`. */
export function formatKm(km: number): string {
  return Math.round(km).toLocaleString("id-ID");
}
