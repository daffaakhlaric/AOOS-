import type { Branch } from "@aos/meta-ads-connector";
import {
  ScrapedKilometer,
  ScrapedPrice,
  ScrapedPromo,
  ScrapedUnit,
  ScrapeTimestamp,
  UnitUrl,
  type Transmission,
} from "@aos/mobix-web-scraper";

import { unwrap } from "../helpers/result.js";

const SCRAPED_AT = unwrap(ScrapeTimestamp.create(new Date("2026-08-09T00:00:00.000Z")));

export interface FixtureUnitInput {
  readonly model: string;
  readonly brand?: string;
  readonly year?: number;
  readonly transmission?: Transmission;
  readonly color?: string;
  readonly km?: number;
  readonly priceIDR: number;
  readonly branch: Branch;
  readonly slug?: string;
  readonly available?: boolean;
}

export function buildScrapedUnit(input: FixtureUnitInput): ScrapedUnit {
  const slug = input.slug ?? `${input.model.toLowerCase().replace(/\s+/g, "-")}-${input.priceIDR}`;
  return unwrap(
    ScrapedUnit.create({
      url: unwrap(UnitUrl.create(`https://mobixbydss.id/unit/${slug}`)),
      model: input.model,
      brand: input.brand ?? "Mitsubishi",
      year: input.year ?? 2020,
      transmission: input.transmission ?? "AT",
      color: input.color ?? "Putih",
      kilometer: unwrap(ScrapedKilometer.create(input.km ?? 45_000)),
      price: unwrap(ScrapedPrice.create(input.priceIDR)),
      branch: input.branch,
      photos: [],
      available: input.available ?? true,
      scrapedAt: SCRAPED_AT,
    }),
  );
}

export interface FixturePromoInput {
  readonly title: string;
  readonly description?: string;
  readonly validUntil?: Date;
  readonly appliesTo?: ReadonlyArray<string>;
}

export function buildScrapedPromo(input: FixturePromoInput): ScrapedPromo {
  return unwrap(
    ScrapedPromo.create({
      title: input.title,
      description: input.description ?? "",
      validUntil: input.validUntil,
      appliesTo: input.appliesTo,
      scrapedAt: SCRAPED_AT,
    }),
  );
}
