import { err, ok, type Result } from "@aos/common";

import { ParseError } from "../../domain/errors/ParseError.js";

/**
 * Parses Indonesian-locale price strings scraped from mobixbydss.id listing pages into a whole-IDR
 * integer. Regex/string-based only (no HTML/number-formatting library — see README "HTML parsing
 * strategy").
 *
 * Recognized shapes:
 *   "Rp 165.000.000"  → dot is a thousands separator (no magnitude suffix) → 165000000
 *   "Rp 1,5 Miliar"    → comma is a decimal separator when a magnitude suffix is present → 1500000000
 *   "165 jt" / "juta"  → juta/jt = ×1,000,000                                            → 165000000
 */
export class PriceParser {
  private static readonly MAGNITUDE_SUFFIXES: ReadonlyArray<{ pattern: RegExp; factor: number }> = [
    { pattern: /miliar$/i, factor: 1_000_000_000 },
    { pattern: /m$/i, factor: 1_000_000_000 },
    { pattern: /juta$/i, factor: 1_000_000 },
    { pattern: /jt$/i, factor: 1_000_000 },
  ];

  static parse(raw: string): Result<number, ParseError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(new ParseError("PriceParser: input must be a non-empty string"));
    }

    const withoutCurrency = raw
      .trim()
      .replace(/^rp\.?\s*/i, "")
      .trim();
    if (withoutCurrency.length === 0) {
      return err(new ParseError(`PriceParser: no numeric content in "${raw}"`));
    }

    for (const { pattern, factor } of PriceParser.MAGNITUDE_SUFFIXES) {
      const match = pattern.exec(withoutCurrency);
      if (match) {
        const numericPart = withoutCurrency.slice(0, match.index).trim();
        // With a magnitude suffix, comma is the decimal separator (Indonesian locale).
        const normalized = numericPart.replace(/\./g, "").replace(",", ".");
        const value = Number.parseFloat(normalized);
        if (!Number.isFinite(value)) {
          return err(new ParseError(`PriceParser: could not parse numeric part of "${raw}"`));
        }
        return ok(Math.round(value * factor));
      }
    }

    // No magnitude suffix: dots are thousands separators, per Indonesian locale.
    const digitsOnly = withoutCurrency.replace(/\./g, "").replace(/,/g, "").replace(/[^\d]/g, "");
    if (digitsOnly.length === 0) {
      return err(new ParseError(`PriceParser: could not parse numeric part of "${raw}"`));
    }
    return ok(Number.parseInt(digitsOnly, 10));
  }
}
