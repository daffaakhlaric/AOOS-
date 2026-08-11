import { err, ok, type Result } from "@aos/common";

import { ParseError } from "../../domain/errors/ParseError.js";

/**
 * Parses Indonesian-locale odometer strings scraped from mobixbydss.id listing pages into a
 * whole-kilometer integer. Regex/string-based only (see `PriceParser` for the same strategy).
 *
 * Recognized shapes:
 *   "45.000 km"  → dot is a thousands separator (no magnitude suffix) → 45000
 *   "45 rb km"   → rb/ribu = ×1,000                                   → 45000
 *   "45.000"     → no unit suffix, still dot-thousands                → 45000
 */
export class KilometerParser {
  private static readonly MAGNITUDE_SUFFIXES: ReadonlyArray<{ pattern: RegExp; factor: number }> = [
    { pattern: /ribu$/i, factor: 1_000 },
    { pattern: /rb$/i, factor: 1_000 },
  ];

  static parse(raw: string): Result<number, ParseError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(new ParseError("KilometerParser: input must be a non-empty string"));
    }

    const withoutUnit = raw.trim().replace(/km$/i, "").trim();
    if (withoutUnit.length === 0) {
      return err(new ParseError(`KilometerParser: no numeric content in "${raw}"`));
    }

    for (const { pattern, factor } of KilometerParser.MAGNITUDE_SUFFIXES) {
      const match = pattern.exec(withoutUnit);
      if (match) {
        const numericPart = withoutUnit.slice(0, match.index).trim();
        const normalized = numericPart.replace(/\./g, "").replace(",", ".");
        const value = Number.parseFloat(normalized);
        if (!Number.isFinite(value)) {
          return err(new ParseError(`KilometerParser: could not parse numeric part of "${raw}"`));
        }
        return ok(Math.round(value * factor));
      }
    }

    const digitsOnly = withoutUnit.replace(/\./g, "").replace(/,/g, "").replace(/[^\d]/g, "");
    if (digitsOnly.length === 0) {
      return err(new ParseError(`KilometerParser: could not parse numeric part of "${raw}"`));
    }
    return ok(Number.parseInt(digitsOnly, 10));
  }
}
