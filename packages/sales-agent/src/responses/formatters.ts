/** Formats a whole-rupiah amount Indonesian-style, e.g. `195000000` → `"195.000.000"`. Shared by `UnitResponses`/`PriceResponses`. */
export function formatPrice(amount: number): string {
  return Math.round(amount).toLocaleString("id-ID");
}

/** Formats a kilometer reading Indonesian-style, e.g. `45000` → `"45.000"`. */
export function formatKm(km: number): string {
  return Math.round(km).toLocaleString("id-ID");
}

/**
 * The single, shared source of truth for Jessy's per-message character cap (spec: "Tidak lebih
 * dari 150 karakter per pesan"). Mirrors `ResponseGenerator`'s own private `SOFT_LENGTH_TARGET`
 * constant (kept there unmodified, per the coordinator note's "keep `ResponseGenerator` fully
 * intact" constraint) — exported here so any *new* response producer (currently only
 * `LlmResponseGenerator`) enforces the exact same limit instead of inventing a second one.
 */
export const MAX_MESSAGE_LENGTH = 150;

/**
 * Trims `text` at the nearest sentence/line boundary at-or-before `maxLength`, falling back to a
 * hard character cut if the text has no such boundary early enough. Shared trimming logic —
 * mirrors `ResponseGenerator`'s private `trimToSentence`.
 */
export function truncateToSentence(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  const truncated = text.slice(0, maxLength);
  const lastBoundary = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?"),
    truncated.lastIndexOf("\n"),
  );
  return lastBoundary > 0 ? text.slice(0, lastBoundary + 1) : truncated;
}
