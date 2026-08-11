import { err, ok, type Result } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";

import { ScrapedUnit, type Transmission } from "../../domain/entities/ScrapedUnit.js";
import { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapedKilometer } from "../../domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../domain/value-objects/UnitUrl.js";

import { KilometerParser } from "./KilometerParser.js";
import { PriceParser } from "./PriceParser.js";

const CARD_PATTERN =
  /<article class="unit-card"[^>]*data-branch="([^"]+)"[^>]*data-available="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g;
const LINK_PATTERN = /<a class="unit-card__link" href="([^"]+)"/;
const TITLE_PATTERN = /<h3 class="unit-card__title">([^<]+)<\/h3>/;
const PRICE_PATTERN = /<span class="unit-card__price">([^<]+)<\/span>/;
const KM_PATTERN = /<span class="unit-card__km">([^<]+)<\/span>/;
const TRANSMISSION_PATTERN = /<span class="unit-card__transmission">([^<]+)<\/span>/;
const COLOR_PATTERN = /<span class="unit-card__color">([^<]+)<\/span>/;
const PHOTO_PATTERN = /<img src="([^"]+)"/g;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

const KNOWN_BRANCHES = new Set<string>(Object.values(Branch));

/**
 * Regex/string-based parser for mobixbydss.id's unit-listing HTML — POC parsing strategy
 * (no DOM/HTML-parsing library, per the package README's "HTML parsing strategy" section).
 * Expects the fixture-shaped `<article class="unit-card" data-branch="…" data-available="…">`
 * card markup documented in `tests/integration` fixtures.
 */
export class UnitListingParser {
  static parse(
    html: string,
    clock: () => Date = () => new Date(),
  ): Result<ScrapedUnit[], ParseError> {
    if (typeof html !== "string" || html.trim().length === 0) {
      return err(new ParseError("UnitListingParser: input HTML must be a non-empty string"));
    }

    const units: ScrapedUnit[] = [];
    let match: RegExpExecArray | null;
    CARD_PATTERN.lastIndex = 0;
    while ((match = CARD_PATTERN.exec(html)) !== null) {
      const [, branchRaw, availableRaw, block] = match;
      const parsed = UnitListingParser.parseCard(branchRaw!, availableRaw!, block!, clock);
      if (!parsed.ok) {
        return parsed;
      }
      units.push(parsed.value);
    }

    if (units.length === 0) {
      return err(new ParseError("UnitListingParser: no unit-card blocks found in HTML"));
    }

    return ok(units);
  }

  private static parseCard(
    branchRaw: string,
    availableRaw: string,
    block: string,
    clock: () => Date,
  ): Result<ScrapedUnit, ParseError> {
    if (!KNOWN_BRANCHES.has(branchRaw)) {
      return err(new ParseError(`UnitListingParser: unrecognized data-branch "${branchRaw}"`));
    }

    const linkMatch = LINK_PATTERN.exec(block);
    const titleMatch = TITLE_PATTERN.exec(block);
    const priceMatch = PRICE_PATTERN.exec(block);
    const kmMatch = KM_PATTERN.exec(block);
    const transmissionMatch = TRANSMISSION_PATTERN.exec(block);
    const colorMatch = COLOR_PATTERN.exec(block);

    if (!linkMatch || !titleMatch || !priceMatch || !kmMatch || !transmissionMatch || !colorMatch) {
      return err(new ParseError("UnitListingParser: unit-card block missing required fields"));
    }

    const title = titleMatch[1]!.trim();
    const yearMatch = YEAR_PATTERN.exec(title);
    if (!yearMatch) {
      return err(new ParseError(`UnitListingParser: could not find a year in title "${title}"`));
    }
    const year = Number.parseInt(yearMatch[0], 10);
    const [brand, ...rest] = title.split(/\s+/);
    const model = rest.join(" ").replace(YEAR_PATTERN, "").trim();
    if (!brand || model.length === 0) {
      return err(
        new ParseError(`UnitListingParser: could not split brand/model from title "${title}"`),
      );
    }

    const transmissionText = transmissionMatch[1]!.trim().toUpperCase();
    if (transmissionText !== "AT" && transmissionText !== "MT") {
      return err(
        new ParseError(`UnitListingParser: unrecognized transmission "${transmissionText}"`),
      );
    }
    const transmission: Transmission = transmissionText;

    const urlResult = UnitUrl.create(linkMatch[1]!);
    if (!urlResult.ok) {
      return err(new ParseError(urlResult.error.message));
    }
    const priceParsed = PriceParser.parse(priceMatch[1]!);
    if (!priceParsed.ok) {
      return err(priceParsed.error);
    }
    const priceResult = ScrapedPrice.create(priceParsed.value);
    /* v8 ignore next 4 */
    if (!priceResult.ok) {
      // Unreachable: PriceParser.parse only ever returns non-negative integers.
      return err(new ParseError(priceResult.error.message));
    }
    const kmParsed = KilometerParser.parse(kmMatch[1]!);
    if (!kmParsed.ok) {
      return err(kmParsed.error);
    }
    const kmResult = ScrapedKilometer.create(kmParsed.value);
    /* v8 ignore next 4 */
    if (!kmResult.ok) {
      // Unreachable: KilometerParser.parse only ever returns non-negative integers.
      return err(new ParseError(kmResult.error.message));
    }

    const photos: string[] = [];
    let photoMatch: RegExpExecArray | null;
    const photoRegex = new RegExp(PHOTO_PATTERN);
    while ((photoMatch = photoRegex.exec(block)) !== null) {
      photos.push(photoMatch[1]!);
    }

    const unitResult = ScrapedUnit.create({
      url: urlResult.value,
      model,
      brand,
      year,
      transmission,
      color: colorMatch[1]!.trim(),
      kilometer: kmResult.value,
      price: priceResult.value,
      branch: branchRaw as Branch,
      photos,
      available: availableRaw === "true",
      scrapedAt: ScrapeTimestamp.now(clock),
    });
    /* v8 ignore next 4 */
    if (!unitResult.ok) {
      // Unreachable: every ScrapedUnit.create validation was already checked above in this method.
      return err(new ParseError(unitResult.error.message));
    }
    return ok(unitResult.value);
  }
}
