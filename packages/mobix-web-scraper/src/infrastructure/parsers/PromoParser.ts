import { err, ok, type Result } from "@aos/common";

import { ScrapedPromo } from "../../domain/entities/ScrapedPromo.js";
import { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapeTimestamp } from "../../domain/value-objects/ScrapeTimestamp.js";

const CARD_PATTERN = /<section class="promo-card">([\s\S]*?)<\/section>/g;
const TITLE_PATTERN = /<h3 class="promo-card__title">([^<]+)<\/h3>/;
const DESC_PATTERN = /<p class="promo-card__desc">([^<]*)<\/p>/;
const VALID_UNTIL_PATTERN = /<span class="promo-card__valid-until">([^<]*)<\/span>/;
const APPLIES_TO_PATTERN = /<span class="promo-card__applies-to">([^<]*)<\/span>/;

/**
 * Regex/string-based parser for mobixbydss.id's promo-page HTML (see `UnitListingParser` for the
 * same no-DOM-library strategy). Expects `<section class="promo-card">` blocks documented in
 * `tests/integration` fixtures.
 */
export class PromoParser {
  static parse(
    html: string,
    clock: () => Date = () => new Date(),
  ): Result<ScrapedPromo[], ParseError> {
    if (typeof html !== "string" || html.trim().length === 0) {
      return err(new ParseError("PromoParser: input HTML must be a non-empty string"));
    }

    const promos: ScrapedPromo[] = [];
    let match: RegExpExecArray | null;
    CARD_PATTERN.lastIndex = 0;
    while ((match = CARD_PATTERN.exec(html)) !== null) {
      const block = match[1]!;
      const titleMatch = TITLE_PATTERN.exec(block);
      const descMatch = DESC_PATTERN.exec(block);
      if (!titleMatch || !descMatch) {
        return err(new ParseError("PromoParser: promo-card block missing required fields"));
      }

      const validUntilMatch = VALID_UNTIL_PATTERN.exec(block);
      const validUntilText = validUntilMatch?.[1]?.trim();
      let validUntil: Date | undefined;
      if (validUntilText && validUntilText.length > 0) {
        const parsedDate = new Date(validUntilText);
        if (Number.isNaN(parsedDate.getTime())) {
          return err(
            new ParseError(`PromoParser: unrecognized valid-until date "${validUntilText}"`),
          );
        }
        validUntil = parsedDate;
      }

      const appliesToMatch = APPLIES_TO_PATTERN.exec(block);
      const appliesToText = appliesToMatch?.[1]?.trim();
      const appliesTo =
        appliesToText && appliesToText.length > 0
          ? appliesToText.split(",").map((m) => m.trim())
          : undefined;

      const promoResult = ScrapedPromo.create({
        title: titleMatch[1]!.trim(),
        description: descMatch[1]!.trim(),
        validUntil,
        appliesTo,
        scrapedAt: ScrapeTimestamp.now(clock),
      });
      if (!promoResult.ok) {
        return err(new ParseError(promoResult.error.message));
      }
      promos.push(promoResult.value);
    }

    if (promos.length === 0) {
      return err(new ParseError("PromoParser: no promo-card blocks found in HTML"));
    }

    return ok(promos);
  }
}
